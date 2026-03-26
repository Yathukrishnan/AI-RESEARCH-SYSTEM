import httpx
import asyncio
import logging
from typing import Dict, Optional, List
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

class EnrichmentService:
    def __init__(self, semantic_scholar_url: str, papers_with_code_url: str):
        self.ss_url = semantic_scholar_url
        self.pwc_url = papers_with_code_url
        self.headers = {"User-Agent": "AI-Research-Intelligence/1.0"}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=10, max=60))
    async def get_semantic_scholar_data(self, arxiv_id: str) -> Optional[Dict]:
        """Fetch citation count, author h-index from Semantic Scholar."""
        await asyncio.sleep(2)  # Rate limiting

        async with httpx.AsyncClient(headers=self.headers, timeout=20) as client:
            try:
                # Search by arXiv ID
                url = f"{self.ss_url}/paper/arXiv:{arxiv_id}"
                params = {
                    "fields": "citationCount,influentialCitationCount,authors,references"
                }
                resp = await client.get(url, params=params)

                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", 30))
                    logger.warning(f"Semantic Scholar rate limited (429) for {arxiv_id}, sleeping {retry_after}s")
                    await asyncio.sleep(retry_after)
                    raise httpx.HTTPStatusError("429 rate limited", request=resp.request, response=resp)

                if resp.status_code == 404:
                    # Try search
                    search_url = f"{self.ss_url}/paper/search"
                    resp = await client.get(search_url, params={
                        "query": f"arxiv:{arxiv_id}",
                        "fields": "citationCount,authors",
                        "limit": 1
                    })
                    if resp.status_code == 429:
                        retry_after = int(resp.headers.get("Retry-After", 30))
                        await asyncio.sleep(retry_after)
                        raise httpx.HTTPStatusError("429 rate limited", request=resp.request, response=resp)

                if resp.status_code != 200:
                    return None

                data = resp.json()

                # Handle search results
                if "data" in data and data["data"]:
                    data = data["data"][0]

                # Get author h-indexes
                h_indices = []
                for author in data.get("authors", [])[:5]:  # Top 5 authors
                    author_id = author.get("authorId")
                    if author_id:
                        h = await self._get_author_h_index(client, author_id)
                        if h:
                            h_indices.append(h)

                return {
                    "citation_count": data.get("citationCount", 0) or 0,
                    "influential_citation_count": data.get("influentialCitationCount", 0) or 0,
                    "h_index_max": max(h_indices) if h_indices else 0.0
                }

            except Exception as e:
                logger.warning(f"Semantic Scholar error for {arxiv_id}: {e}")
                return None

    async def _get_author_h_index(self, client: httpx.AsyncClient, author_id: str) -> Optional[float]:
        try:
            await asyncio.sleep(0.5)
            resp = await client.get(
                f"{self.ss_url}/author/{author_id}",
                params={"fields": "hIndex"},
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                return float(data.get("hIndex", 0) or 0)
        except Exception:
            pass
        return None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def get_github_data(self, arxiv_id: str, title: str) -> Optional[Dict]:
        """Fetch GitHub repo data from Papers with Code."""
        await asyncio.sleep(0.5)

        async with httpx.AsyncClient(headers=self.headers, timeout=15) as client:
            try:
                resp = await client.get(
                    f"{self.pwc_url}/papers/",
                    params={"arxiv_id": arxiv_id},
                    timeout=15
                )

                if resp.status_code != 200 or not resp.json().get("results"):
                    return None

                papers = resp.json()["results"]
                if not papers:
                    return None

                paper_data = papers[0]

                # Get repo info
                if paper_data.get("official") and paper_data["official"].get("url"):
                    github_url = paper_data["official"]["url"]
                    stars = paper_data["official"].get("stars", 0) or 0
                    return {"github_url": github_url, "github_stars": stars, "github_forks": 0}

                # Try repos endpoint
                repos_resp = await client.get(
                    f"{self.pwc_url}/papers/{paper_data.get('id', '')}/repositories/",
                    timeout=10
                )
                if repos_resp.status_code == 200:
                    repos = repos_resp.json()
                    if repos:
                        top_repo = max(repos, key=lambda r: r.get("stars", 0))
                        return {
                            "github_url": top_repo.get("url", ""),
                            "github_stars": top_repo.get("stars", 0) or 0,
                            "github_forks": top_repo.get("forks", 0) or 0
                        }

            except Exception as e:
                logger.warning(f"Papers with Code error for {arxiv_id}: {e}")

        return None

    async def enrich_paper(self, arxiv_id: str, title: str) -> Dict:
        """Enrich a paper with all external data. Returns partial results on failure."""
        result = {
            "citation_count": 0,
            "influential_citation_count": 0,
            "h_index_max": 0.0,
            "github_url": None,
            "github_stars": 0,
            "github_forks": 0
        }

        # Fetch concurrently with individual error handling
        ss_task = self.get_semantic_scholar_data(arxiv_id)
        github_task = self.get_github_data(arxiv_id, title)

        ss_data, github_data = await asyncio.gather(ss_task, github_task, return_exceptions=True)

        if isinstance(ss_data, dict):
            result.update(ss_data)

        if isinstance(github_data, dict):
            result.update(github_data)

        return result
