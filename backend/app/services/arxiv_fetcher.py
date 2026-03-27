import httpx
import feedparser
import hashlib
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

logger = logging.getLogger(__name__)

ARXIV_CATEGORIES = ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.NE", "stat.ML"]

async def get_active_categories() -> List[str]:
    """Load active subject categories from DB, fall back to hardcoded list."""
    try:
        from app.core.turso import db as turso_db
        rows = await turso_db.fetchall(
            "SELECT subject_code FROM arxiv_subjects WHERE is_active = 1 ORDER BY subject_code"
        )
        if rows:
            return [r["subject_code"] for r in rows]
    except Exception:
        pass
    return ARXIV_CATEGORIES

def compute_hash(arxiv_id: str) -> str:
    return hashlib.sha256(arxiv_id.encode()).hexdigest()

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=4, max=60),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError))
)
async def fetch_arxiv_page(client: httpx.AsyncClient, query: str, start: int, max_results: int = 100) -> List[Dict]:
    """Fetch one page of arXiv results with retry logic."""
    params = {
        "search_query": query,
        "start": start,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending"
    }

    # Rate limiting - be respectful to arXiv API
    await asyncio.sleep(3)  # 3 second delay between requests

    resp = await client.get(settings.ARXIV_API_URL, params=params, timeout=30)
    resp.raise_for_status()

    feed = feedparser.parse(resp.text)
    papers = []

    for entry in feed.entries:
        try:
            paper = parse_arxiv_entry(entry)
            if paper:
                papers.append(paper)
        except Exception as e:
            logger.warning(f"Error parsing entry: {e}")
            continue

    return papers

def parse_arxiv_entry(entry) -> Optional[Dict]:
    """Parse a single arXiv feed entry."""
    arxiv_id = entry.get("id", "").split("/abs/")[-1].replace("v", "").strip()
    # Handle versioned IDs like 2401.12345v2 -> 2401.12345
    if "v" in arxiv_id.split(".")[-1]:
        arxiv_id = arxiv_id.rsplit("v", 1)[0]

    if not arxiv_id:
        return None

    # Parse categories
    categories = []
    if hasattr(entry, "tags"):
        categories = [tag.term for tag in entry.tags if hasattr(tag, "term")]

    # Parse authors
    authors = []
    if hasattr(entry, "authors"):
        for author in entry.authors:
            authors.append({"name": author.get("name", ""), "h_index": None})

    # Parse dates
    published_at = None
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        published_at = datetime(*entry.published_parsed[:6]).isoformat()

    updated_at = None
    if hasattr(entry, "updated_parsed") and entry.updated_parsed:
        updated_at = datetime(*entry.updated_parsed[:6]).isoformat()

    # Parse links
    pdf_url = None
    html_url = None
    for link in getattr(entry, "links", []):
        if link.get("type") == "application/pdf":
            pdf_url = link.get("href", "")
        elif link.get("rel") == "alternate":
            html_url = link.get("href", "")

    if not pdf_url:
        pdf_url = f"https://arxiv.org/pdf/{arxiv_id}"
    if not html_url:
        html_url = f"https://arxiv.org/abs/{arxiv_id}"

    primary_category = categories[0] if categories else "cs.AI"

    return {
        "arxiv_id": arxiv_id,
        "hash_id": compute_hash(arxiv_id),
        "title": entry.get("title", "").replace("\n", " ").strip(),
        "abstract": entry.get("summary", "").replace("\n", " ").strip(),
        "authors": authors,
        "categories": categories,
        "primary_category": primary_category,
        "published_at": published_at,
        "updated_at": updated_at,
        "pdf_url": pdf_url,
        "html_url": html_url,
        "doi": getattr(entry, "arxiv_doi", None),
        "journal_ref": getattr(entry, "arxiv_journal_ref", None),
    }

async def fetch_papers_for_date_range(days: int = 1, max_per_category: int = 500) -> List[Dict]:
    """Fetch papers from the last N days across all AI categories."""
    all_papers = []
    seen_ids = set()

    # Build date filter
    since_date = datetime.utcnow() - timedelta(days=days)
    date_filter = since_date.strftime("%Y%m%d")

    async with httpx.AsyncClient(
        headers={"User-Agent": "AI-Research-Intelligence/1.0 (research tool)"},
        follow_redirects=True
    ) as client:
        # Build combined category query
        active_cats = await get_active_categories()
        cat_query = " OR ".join([f"cat:{c}" for c in active_cats])
        query = f"({cat_query}) AND submittedDate:[{date_filter}000000 TO 99991231235959]"

        start = 0
        batch_size = 100

        while start < max_per_category:
            try:
                papers = await fetch_arxiv_page(client, query, start, batch_size)

                if not papers:
                    break

                new_papers = []
                for p in papers:
                    if p["arxiv_id"] not in seen_ids:
                        seen_ids.add(p["arxiv_id"])
                        new_papers.append(p)

                all_papers.extend(new_papers)

                if len(papers) < batch_size:
                    break  # No more results

                start += batch_size
                logger.info(f"Fetched {len(all_papers)} papers so far (offset={start})")

            except Exception as e:
                logger.error(f"Error fetching papers at offset {start}: {e}")
                await asyncio.sleep(10)  # Back off on error
                break

    logger.info(f"Total unique papers fetched: {len(all_papers)}")
    return all_papers

async def fetch_single_paper(arxiv_id: str) -> Optional[Dict]:
    """Fetch a single paper by arXiv ID."""
    async with httpx.AsyncClient(
        headers={"User-Agent": "AI-Research-Intelligence/1.0"},
        follow_redirects=True
    ) as client:
        try:
            query = f"id:{arxiv_id}"
            papers = await fetch_arxiv_page(client, query, 0, 1)
            return papers[0] if papers else None
        except Exception as e:
            logger.error(f"Error fetching paper {arxiv_id}: {e}")
            return None
