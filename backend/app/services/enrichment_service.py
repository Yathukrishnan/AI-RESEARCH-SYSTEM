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


class EnrichmentService:
    def __init__(self, semantic_scholar_url: str, papers_with_code_url: str):
        self.ss_url  = semantic_scholar_url
        self.pwc_url = papers_with_code_url
        self.headers = {"User-Agent": "AI-Research-Intelligence/1.0"}

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
        """Single Papers-with-Code lookup (no retry — caller handles failures gracefully)."""
        async with httpx.AsyncClient(headers=self.headers, timeout=12) as client:
            try:
                resp = await client.get(
                    f"{self.pwc_url}/papers/",
                    params={"arxiv_id": arxiv_id},
                )
                if resp.status_code != 200:
                    return None

                results = resp.json().get("results") or []
                if not results:
                    return None

                paper_data = results[0]

                # Official repo
                if paper_data.get("official") and paper_data["official"].get("url"):
                    return {
                        "github_url": paper_data["official"]["url"],
                        "github_stars": int(paper_data["official"].get("stars") or 0),
                        "github_forks": 0,
                    }

                # Fallback: repos endpoint
                repos_resp = await client.get(
                    f"{self.pwc_url}/papers/{paper_data.get('id', '')}/repositories/",
                    timeout=10,
                )
                if repos_resp.status_code == 200:
                    repos = repos_resp.json() or []
                    if repos:
                        top = max(repos, key=lambda r: r.get("stars", 0))
                        return {
                            "github_url": top.get("url", ""),
                            "github_stars": int(top.get("stars") or 0),
                            "github_forks": int(top.get("forks") or 0),
                        }
            except Exception as e:
                logger.debug(f"PwC fetch error {arxiv_id}: {e}")
        return None

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
