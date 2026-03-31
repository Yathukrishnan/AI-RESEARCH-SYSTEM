import httpx
import asyncio
import logging
from typing import Dict, Optional, List
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

# ── Rate-limit constants ────────────────────────────────────────────────────
# Semantic Scholar free tier: 100 requests / 5 min = 1 req / 3 s
# Batch endpoint counts as 1 request regardless of how many papers.
# We use 2 SS calls per chunk (paper batch + author batch) → 1 chunk per 4s = safe.
SS_BATCH_SIZE   = 50    # papers per SS batch API call (max 500, keep at 50 for safety)
SS_CHUNK_DELAY  = 4.0   # seconds between SS batch chunks  (2 calls × 2s margin)
PWC_CONCURRENCY = 5     # concurrent Papers-with-Code calls per chunk
PWC_DELAY       = 0.3   # seconds between each PwC call slot

# Social signal API delays (prevents 429s on free-tier APIs)
# HuggingFace: no documented limit but be polite
# HackerNews Algolia: very generous (no auth, but avoid hammering)
# OpenAlex: 10 req/sec polite pool — keep ≥ 0.1s between calls
HF_DELAY = 0.05   # 50 ms — HuggingFace Papers
HN_DELAY = 0.05   # 50 ms — HackerNews Algolia
OA_DELAY = 0.12   # 120 ms — OpenAlex (stays well under 10 req/sec)

# Max concurrent papers when fetching social signals:
# 3 papers × 3 API calls = 9 requests in flight → safe under OA 10 req/sec limit
SOCIAL_CONCURRENCY = 3


class EnrichmentService:
    def __init__(
        self,
        semantic_scholar_url: str,
        papers_with_code_url: str,
        github_token: str = "",
        github_api_url: str = "https://api.github.com",
    ):
        self.ss_url     = semantic_scholar_url
        self.pwc_url    = papers_with_code_url
        self.github_url = github_api_url
        self.headers    = {"User-Agent": "AI-Research-Intelligence/1.0"}
        # GitHub API headers — with token: 5000 req/h, without: 60 req/h
        self.gh_headers = {"User-Agent": "AI-Research-Intelligence/1.0", "Accept": "application/vnd.github+json"}
        if github_token:
            self.gh_headers["Authorization"] = f"Bearer {github_token}"

    # ── Semantic Scholar batch ─────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=10, max=90))
    async def get_semantic_scholar_batch(self, arxiv_ids: List[str]) -> Dict[str, Dict]:
        """
        Fetch citation + h-index data for up to SS_BATCH_SIZE papers in 2 API calls:
          1. POST /paper/batch  → citation counts + author IDs
          2. POST /author/batch → h-indices for all collected authors
        Returns {arxiv_id: {citation_count, influential_citation_count, h_index_max}}
        """
        if not arxiv_ids:
            return {}

        ids = [f"ARXIV:{aid}" for aid in arxiv_ids]

        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            # ── Call 1: paper batch ──────────────────────────────────────
            try:
                resp = await client.post(
                    f"{self.ss_url}/paper/batch",
                    json={"ids": ids},
                    params={"fields": "citationCount,influentialCitationCount,authors"},
                )
            except Exception as e:
                logger.warning(f"SS paper batch request error: {e}")
                return {}

            if resp.status_code == 429:
                wait_s = int(resp.headers.get("Retry-After", 60))
                logger.warning(f"SS paper batch 429 — sleeping {wait_s}s")
                await asyncio.sleep(wait_s)
                raise httpx.HTTPStatusError("429", request=resp.request, response=resp)

            if resp.status_code != 200:
                logger.warning(f"SS paper batch returned {resp.status_code}")
                return {}

            raw = resp.json()  # list, same order as ids; null if not found

            result_map: Dict[str, Dict] = {}
            all_author_ids: List[str] = []
            paper_author_map: Dict[str, List[str]] = {}  # arxiv_id -> [authorId...]

            for i, item in enumerate(raw):
                if i >= len(arxiv_ids):
                    break
                arxiv_id = arxiv_ids[i]
                if not item or not isinstance(item, dict):
                    # Not found in SS — still record zeros so caller can decide
                    result_map[arxiv_id] = {
                        "citation_count": 0,
                        "influential_citation_count": 0,
                        "h_index_max": 0.0,
                    }
                    continue

                authors = item.get("authors") or []
                author_ids = [a["authorId"] for a in authors[:5] if a.get("authorId")]
                paper_author_map[arxiv_id] = author_ids
                all_author_ids.extend(author_ids)

                result_map[arxiv_id] = {
                    "citation_count": int(item.get("citationCount") or 0),
                    "influential_citation_count": int(item.get("influentialCitationCount") or 0),
                    "h_index_max": 0.0,  # filled after author batch
                }

            # ── Call 2: author batch (h-index) ───────────────────────────
            if all_author_ids:
                await asyncio.sleep(1.0)  # brief pause between the two SS calls
                h_map = await self._get_author_h_indices_batch(client, list(set(all_author_ids)))
                for arxiv_id, author_ids in paper_author_map.items():
                    hs = [h_map.get(aid, 0.0) for aid in author_ids]
                    result_map[arxiv_id]["h_index_max"] = float(max(hs)) if hs else 0.0

            return result_map

    async def _get_author_h_indices_batch(
        self, client: httpx.AsyncClient, author_ids: List[str]
    ) -> Dict[str, float]:
        """POST /author/batch — up to 1000 author IDs in one call."""
        if not author_ids:
            return {}
        try:
            resp = await client.post(
                f"{self.ss_url}/author/batch",
                json={"ids": author_ids[:1000]},
                params={"fields": "hIndex"},
                timeout=20,
            )
            if resp.status_code == 429:
                wait_s = int(resp.headers.get("Retry-After", 30))
                await asyncio.sleep(wait_s)
                return {}
            if resp.status_code != 200:
                return {}
            raw = resp.json()
            return {
                author_ids[i]: float(item.get("hIndex") or 0)
                for i, item in enumerate(raw)
                if item and isinstance(item, dict) and i < len(author_ids)
            }
        except Exception as e:
            logger.warning(f"SS author batch error: {e}")
            return {}

    # ── Papers with Code (concurrent) ──────────────────────────────────────

    async def get_github_data_concurrent(
        self, papers: List[Dict], concurrency: int = PWC_CONCURRENCY
    ) -> Dict[str, Optional[Dict]]:
        """
        Fetch GitHub data for multiple papers concurrently.
        Uses a semaphore so at most `concurrency` calls run at once.
        Returns {arxiv_id: {github_url, github_stars, github_forks} or None}
        """
        semaphore = asyncio.Semaphore(concurrency)

        async def _one(p: Dict):
            async with semaphore:
                await asyncio.sleep(PWC_DELAY)
                try:
                    data = await self._fetch_github(p["arxiv_id"], p["title"])
                    return p["arxiv_id"], data
                except Exception as e:
                    logger.debug(f"PwC error {p['arxiv_id']}: {e}")
                    return p["arxiv_id"], None

        results = await asyncio.gather(*[_one(p) for p in papers], return_exceptions=True)
        return {
            arxiv_id: data
            for r in results
            if not isinstance(r, Exception)
            for arxiv_id, data in [r]
        }

    async def _fetch_github(self, arxiv_id: str, title: str) -> Optional[Dict]:
        """
        1. Papers With Code → arXiv ID → GitHub URL (URL discovery)
        2. GitHub REST API → accurate real-time star + fork count
        Falls back to PwC star count if GitHub API call fails.
        """
        # Strip version suffix (e.g. "2303.08774v2" → "2303.08774") — PwC uses base IDs
        clean_id = arxiv_id.split("v")[0] if "v" in arxiv_id else arxiv_id

        github_url: Optional[str] = None
        pwc_stars: int = 0
        pwc_forks: int = 0

        async with httpx.AsyncClient(headers=self.headers, timeout=12) as client:
            try:
                resp = await client.get(
                    f"{self.pwc_url}/papers/",
                    params={"arxiv_id": clean_id},
                )
                if resp.status_code != 200:
                    return None

                body = resp.json()
                results = (body.get("results") if isinstance(body, dict) else body) or []
                if not results:
                    return None

                paper_data = results[0]

                # Try official repo first (has URL but stars may be stale/missing)
                if paper_data.get("official") and paper_data["official"].get("url"):
                    github_url  = paper_data["official"]["url"]
                    pwc_stars   = int(paper_data["official"].get("stars") or 0)

                # If no official, try repositories endpoint for top-starred repo
                if not github_url:
                    paper_id = paper_data.get("id", "")
                    if paper_id:
                        repos_resp = await client.get(
                            f"{self.pwc_url}/papers/{paper_id}/repositories/",
                            timeout=10,
                        )
                        if repos_resp.status_code == 200:
                            repos_body = repos_resp.json()
                            repos = (repos_body.get("results") if isinstance(repos_body, dict) else repos_body) or []
                            if repos:
                                top = max(repos, key=lambda r: r.get("stars", 0) if isinstance(r, dict) else 0)
                                github_url = top.get("url", "")
                                pwc_stars  = int(top.get("stars") or 0)
                                pwc_forks  = int(top.get("forks") or 0)

            except Exception as e:
                logger.debug(f"PwC fetch error {arxiv_id}: {e}")
                return None

        if not github_url:
            return None

        # ── GitHub REST API — get accurate real-time star count ────────────────
        # PwC's cached counts can be weeks out of date; GitHub API is live.
        stars, forks = pwc_stars, pwc_forks
        try:
            # Extract "{owner}/{repo}" from the GitHub URL
            parts = github_url.rstrip("/").split("github.com/")
            if len(parts) == 2:
                repo_path = parts[1].split("/tree/")[0].split("/blob/")[0]  # strip branch paths
                async with httpx.AsyncClient(headers=self.gh_headers, timeout=10) as gh:
                    gh_resp = await gh.get(f"{self.github_url}/repos/{repo_path}")
                    if gh_resp.status_code == 200:
                        gh_data = gh_resp.json()
                        stars = gh_data.get("stargazers_count", pwc_stars)
                        forks = gh_data.get("forks_count", pwc_forks)
                    elif gh_resp.status_code == 403:
                        logger.debug(f"GitHub rate limit hit for {repo_path} — using PwC stars")
        except Exception as e:
            logger.debug(f"GitHub API error for {github_url}: {e}")

        return {"github_url": github_url, "github_stars": stars, "github_forks": forks}

    # ── Legacy single-paper method (kept for manual/single-paper use) ──────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=10, max=60))
    async def get_semantic_scholar_data(self, arxiv_id: str) -> Optional[Dict]:
        """Single-paper SS lookup (used for manual paper adds, not batch enrichment)."""
        await asyncio.sleep(2)
        async with httpx.AsyncClient(headers=self.headers, timeout=20) as client:
            try:
                url = f"{self.ss_url}/paper/arXiv:{arxiv_id}"
                resp = await client.get(url, params={"fields": "citationCount,influentialCitationCount,authors"})

                if resp.status_code == 429:
                    wait_s = int(resp.headers.get("Retry-After", 30))
                    await asyncio.sleep(wait_s)
                    raise httpx.HTTPStatusError("429", request=resp.request, response=resp)

                if resp.status_code == 404:
                    resp = await client.get(
                        f"{self.ss_url}/paper/search",
                        params={"query": f"arxiv:{arxiv_id}", "fields": "citationCount,authors", "limit": 1},
                    )
                    if resp.status_code == 429:
                        await asyncio.sleep(int(resp.headers.get("Retry-After", 30)))
                        raise httpx.HTTPStatusError("429", request=resp.request, response=resp)

                if resp.status_code != 200:
                    return None

                data = resp.json()
                if "data" in data and data["data"]:
                    data = data["data"][0]

                h_indices = []
                for author in (data.get("authors") or [])[:5]:
                    aid = author.get("authorId")
                    if aid:
                        h = await self._get_author_h_index(client, aid)
                        if h:
                            h_indices.append(h)

                return {
                    "citation_count": data.get("citationCount", 0) or 0,
                    "influential_citation_count": data.get("influentialCitationCount", 0) or 0,
                    "h_index_max": max(h_indices) if h_indices else 0.0,
                }
            except httpx.HTTPStatusError:
                raise
            except Exception as e:
                logger.warning(f"SS single error {arxiv_id}: {e}")
                return None

    async def _get_author_h_index(self, client: httpx.AsyncClient, author_id: str) -> Optional[float]:
        try:
            await asyncio.sleep(0.5)
            resp = await client.get(f"{self.ss_url}/author/{author_id}", params={"fields": "hIndex"}, timeout=10)
            if resp.status_code == 200:
                return float(resp.json().get("hIndex") or 0)
        except Exception:
            pass
        return None

    # ── HuggingFace Papers ─────────────────────────────────────────────────

    async def get_huggingface_data(self, arxiv_id: str) -> Dict:
        """Fetch upvotes from HuggingFace Papers (free, no auth)."""
        await asyncio.sleep(HF_DELAY)
        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=10) as client:
                resp = await client.get(f"https://huggingface.co/api/papers/{arxiv_id}")
                if resp.status_code == 200:
                    data = resp.json()
                    return {"hf_upvotes": int(data.get("upvotes") or 0)}
        except Exception as e:
            logger.debug(f"HF fetch error {arxiv_id}: {e}")
        return {"hf_upvotes": 0}

    # ── HackerNews Algolia ─────────────────────────────────────────────────

    async def get_hackernews_data(self, arxiv_id: str, title: str) -> Dict:
        """Search HackerNews for paper discussion via Algolia API (free, no auth)."""
        await asyncio.sleep(HN_DELAY)
        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=10) as client:
                resp = await client.get(
                    "https://hn.algolia.com/api/v1/search",
                    params={"query": f"arxiv.org/abs/{arxiv_id}", "tags": "story", "hitsPerPage": 5},
                )
                if resp.status_code == 200:
                    hits = resp.json().get("hits") or []
                    points = sum(int(h.get("points") or 0) for h in hits)
                    comments = sum(int(h.get("num_comments") or 0) for h in hits)
                    return {"hn_points": points, "hn_comments": comments}
        except Exception as e:
            logger.debug(f"HN fetch error {arxiv_id}: {e}")
        return {"hn_points": 0, "hn_comments": 0}

    # ── OpenAlex ───────────────────────────────────────────────────────────

    async def get_openalex_data(self, arxiv_id: str) -> Dict:
        """
        Fetch citation count + year-over-year velocity from OpenAlex.
        Free, no auth — 100k requests/day. Uses polite pool via User-Agent email.
        Rate limit: 10 req/sec — OA_DELAY (120 ms) keeps us safely under that.
        """
        await asyncio.sleep(OA_DELAY)
        try:
            from datetime import datetime
            hdrs = {**self.headers, "User-Agent": "AI-Research-Intelligence/1.0 (mailto:research@ai.system)"}
            async with httpx.AsyncClient(headers=hdrs, timeout=15) as client:
                resp = await client.get(
                    f"https://api.openalex.org/works/arxiv:{arxiv_id}",
                    params={"select": "id,cited_by_count,counts_by_year"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    cited_by = int(data.get("cited_by_count") or 0)
                    counts = data.get("counts_by_year") or []
                    cur_year = datetime.now().year
                    this_yr = next((c["cited_by_count"] for c in counts if c.get("year") == cur_year), 0)
                    last_yr = next((c["cited_by_count"] for c in counts if c.get("year") == cur_year - 1), 0)
                    velocity = min(1.0, this_yr / max(last_yr, 1)) if this_yr > 0 else 0.0
                    return {
                        "openalex_citation_count": cited_by,
                        "citation_velocity": round(velocity, 4),
                    }
        except Exception as e:
            logger.debug(f"OpenAlex fetch error {arxiv_id}: {e}")
        return {"openalex_citation_count": 0, "citation_velocity": 0.0}

    # ── Author cache (paper_authors table) ────────────────────────────────

    async def get_semantic_scholar_batch_extended(
        self, arxiv_ids: List[str]
    ) -> tuple:
        """
        Like get_semantic_scholar_batch but also returns (paper_author_map, author_name_map, h_map)
        for populating the paper_authors cache table.
        Returns: (result_map, paper_author_map, author_name_map, h_map)
        """
        if not arxiv_ids:
            return {}, {}, {}, {}

        ids = [f"ARXIV:{aid}" for aid in arxiv_ids]
        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            try:
                resp = await client.post(
                    f"{self.ss_url}/paper/batch",
                    json={"ids": ids},
                    params={"fields": "citationCount,influentialCitationCount,authors"},
                )
            except Exception as e:
                logger.warning(f"SS batch extended error: {e}")
                return {}, {}, {}, {}

            if resp.status_code == 429:
                await asyncio.sleep(int(resp.headers.get("Retry-After", 60)))
                return {}, {}, {}, {}
            if resp.status_code != 200:
                return {}, {}, {}, {}

            raw = resp.json()
            result_map: Dict[str, Dict] = {}
            all_author_ids: List[str] = []
            paper_author_map: Dict[str, List[str]] = {}
            author_name_map: Dict[str, str] = {}

            for i, item in enumerate(raw):
                if i >= len(arxiv_ids):
                    break
                arxiv_id = arxiv_ids[i]
                if not item or not isinstance(item, dict):
                    result_map[arxiv_id] = {"citation_count": 0, "influential_citation_count": 0, "h_index_max": 0.0}
                    continue
                authors = item.get("authors") or []
                author_ids = []
                for a in authors[:5]:
                    aid = a.get("authorId")
                    if aid:
                        author_ids.append(aid)
                        if a.get("name"):
                            author_name_map[aid] = a["name"]
                paper_author_map[arxiv_id] = author_ids
                all_author_ids.extend(author_ids)
                result_map[arxiv_id] = {
                    "citation_count": int(item.get("citationCount") or 0),
                    "influential_citation_count": int(item.get("influentialCitationCount") or 0),
                    "h_index_max": 0.0,
                }

            h_map: Dict[str, float] = {}
            if all_author_ids:
                await asyncio.sleep(1.0)
                h_map = await self._get_author_h_indices_batch(client, list(set(all_author_ids)))
                for arxiv_id, author_ids in paper_author_map.items():
                    hs = [h_map.get(aid, 0.0) for aid in author_ids]
                    result_map[arxiv_id]["h_index_max"] = float(max(hs)) if hs else 0.0

            return result_map, paper_author_map, author_name_map, h_map

    async def get_github_data(self, arxiv_id: str, title: str) -> Optional[Dict]:
        """Single PwC lookup (used for manual paper adds)."""
        await asyncio.sleep(0.5)
        return await self._fetch_github(arxiv_id, title)

    async def enrich_paper(self, arxiv_id: str, title: str) -> Dict:
        """Single-paper full enrichment (used for manual paper adds)."""
        result = {"citation_count": 0, "influential_citation_count": 0, "h_index_max": 0.0,
                  "github_url": None, "github_stars": 0, "github_forks": 0}
        ss_data, github_data = await asyncio.gather(
            self.get_semantic_scholar_data(arxiv_id),
            self.get_github_data(arxiv_id, title),
            return_exceptions=True,
        )
        if isinstance(ss_data, dict):
            result.update(ss_data)
        if isinstance(github_data, dict):
            result.update(github_data)
        return result
