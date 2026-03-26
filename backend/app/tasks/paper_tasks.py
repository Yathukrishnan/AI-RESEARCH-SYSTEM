"""
Paper pipeline tasks: fetch → dedup → store → enrich → score → assign week.
"""
import asyncio
import json
import hashlib
import logging
from datetime import datetime, timezone

from app.core.turso import db as turso_db
from app.core.database import get_system_config
from app.core.config import settings
from app.services.scorer import compute_score, normalize_batch, trend_label
from app.services.ai_service import AIValidationService, compute_tfidf_keyword_score, AI_KEYWORDS
from app.services.enrichment_service import EnrichmentService
from app.services.arxiv_fetcher import fetch_papers_for_date_range, fetch_single_paper

logger = logging.getLogger(__name__)


async def _get_keywords():
    rows = await turso_db.fetchall("SELECT keyword FROM keywords WHERE is_active = 1")
    extras = [r["keyword"] for r in rows]
    return extras + AI_KEYWORDS if extras else AI_KEYWORDS


async def _current_week_number() -> int:
    start_str = await get_system_config("SYSTEM_START_DATE")
    if not start_str:
        return 1
    try:
        start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        days = (datetime.now(timezone.utc) - start).days
        return max(1, days // 7 + 1)
    except Exception:
        return 1


async def score_existing_papers():
    """Score any unscored papers – called on startup."""
    from app.tasks.analysis import score_all_papers, normalize_scores, assign_trend_labels

    unscored = await turso_db.count(
        "papers", "is_deleted = 0 AND is_duplicate = 0 AND (current_score IS NULL OR current_score = 0)"
    )
    if unscored == 0:
        return

    logger.info(f"Startup: scoring {unscored} unscored papers…")
    await turso_db.execute(
        "INSERT INTO analysis_log (run_type, status) VALUES ('startup_score', 'running')"
    )
    log_row = await turso_db.fetchone("SELECT rowid as id FROM analysis_log ORDER BY rowid DESC LIMIT 1")
    log_id = log_row["id"] if log_row else 0

    await score_all_papers(log_id)
    await normalize_scores()
    await assign_trend_labels()

    await turso_db.execute(
        "UPDATE analysis_log SET status = 'complete', finished_at = datetime('now') WHERE id = ?",
        [log_id]
    )


async def rescore_all_papers():
    """Weekly re-score all papers, update SCR and trends."""
    logger.info("Weekly rescore starting…")
    from app.tasks.analysis import normalize_scores, assign_trend_labels

    rows = await turso_db.fetchall(
        "SELECT rowid as id, * FROM papers WHERE is_deleted = 0 AND is_duplicate = 0"
    )
    if not rows:
        return

    now = datetime.now(timezone.utc)
    threshold = settings.SCR_THRESHOLD

    for paper in rows:
        try:
            old_score = float(paper.get("current_score") or 0)
            score, score_type = compute_score(dict(paper))

            last_scored = paper.get("last_scored_at")
            hours = 168.0  # default 1 week
            if last_scored:
                try:
                    ls = datetime.fromisoformat(last_scored.replace("Z", "+00:00"))
                    if ls.tzinfo is None:
                        ls = ls.replace(tzinfo=timezone.utc)
                    hours = max(1.0, (now - ls).total_seconds() / 3600)
                except Exception:
                    pass

            from app.services.scorer import compute_scr
            scr = compute_scr(score, old_score, hours)
            is_trending = 1 if scr > threshold else 0
            stale = int(paper.get("stale_score_weeks") or 0)
            stale = stale + 1 if abs(score - old_score) < 0.001 else 0

            await turso_db.execute(
                """UPDATE papers SET previous_score=?, current_score=?, score_type=?,
                   scr_value=?, is_trending=?, stale_score_weeks=?, last_scored_at=?
                   WHERE rowid=?""",
                [old_score, score, score_type, scr, is_trending, stale, now.isoformat(), paper["id"]]
            )
            await turso_db.execute(
                "INSERT INTO score_history (paper_id, score, score_type, scr_value) VALUES (?, ?, ?, ?)",
                [paper["id"], score, score_type, scr]
            )
        except Exception as e:
            logger.error(f"Rescore error {paper.get('id')}: {e}")

    # Soft-delete papers stale 2+ weeks with no improvement and low score
    await turso_db.execute(
        "UPDATE papers SET is_deleted = 1 WHERE stale_score_weeks >= 2 AND current_score < 0.10 AND is_deleted = 0"
    )

    await normalize_scores()
    await assign_trend_labels()
    logger.info("Weekly rescore complete")


async def enrich_pending_papers(batch_size: int = 100):
    rows = await turso_db.fetchall(
        "SELECT rowid as id, arxiv_id, title FROM papers WHERE is_enriched = 0 AND is_deleted = 0 "
        "ORDER BY COALESCE(normalized_score, current_score, keyword_score, 0) DESC LIMIT ?",
        [batch_size]
    )
    if not rows:
        logger.info("Enrich: no pending papers")
        return

    enricher = EnrichmentService(settings.SEMANTIC_SCHOLAR_API_URL, settings.PAPERS_WITH_CODE_API_URL)
    now = datetime.now(timezone.utc).isoformat()
    enriched_ids = []

    logger.info(f"Enriching {len(rows)} papers (citations + GitHub)…")
    for p in rows:
        try:
            data = await enricher.enrich_paper(p["arxiv_id"], p["title"])
            citation_count = int(data.get("citation_count") or 0)
            h_index = float(data.get("h_index_max") or 0.0)
            github_url = data.get("github_url")
            github_stars = int(data.get("github_stars") or 0)
            github_forks = int(data.get("github_forks") or 0)
            # Only mark is_enriched=1 if we got real data OR confirmed the paper
            # simply has no citations/repos (not a rate-limit failure).
            # We distinguish by checking if the enrichment returned None for SS data
            # (rate-limited papers will have been skipped by the caller raising).
            got_real_data = citation_count > 0 or github_stars > 0 or github_url is not None
            # Mark enriched regardless — but track whether we got data.
            # If SS was fully unavailable (all zeros), still mark done so we don't hammer it.
            # Papers can be reset via admin endpoint if needed.
            await turso_db.execute(
                "UPDATE papers SET citation_count=?, h_index_max=?, github_url=?, "
                "github_stars=?, github_forks=?, is_enriched=1, last_enriched_at=? WHERE rowid=?",
                [citation_count, h_index, github_url, github_stars, github_forks, now, p["id"]]
            )
            enriched_ids.append(p["id"])
            if got_real_data:
                logger.debug(f"Enriched {p['arxiv_id']}: citations={citation_count}, stars={github_stars}")
        except Exception as e:
            logger.error(f"Enrich {p['arxiv_id']}: {e}")
            # Do NOT mark is_enriched=1 on exception — let it retry next hour

    logger.info(f"Enriched {len(enriched_ids)} papers")

    # Rescore enriched papers so citation/github data improves their scores immediately
    if enriched_ids:
        from app.tasks.analysis import normalize_scores, assign_trend_labels
        from app.services.scorer import compute_score
        now_dt = datetime.now(timezone.utc)
        for pid in enriched_ids:
            try:
                row = await turso_db.fetchone("SELECT rowid as id, * FROM papers WHERE rowid=?", [pid])
                if not row:
                    continue
                score, score_type = compute_score(dict(row))
                await turso_db.execute(
                    "UPDATE papers SET current_score=?, score_type=?, last_scored_at=? WHERE rowid=?",
                    [score, score_type, now_dt.isoformat(), pid]
                )
            except Exception as e:
                logger.error(f"Rescore after enrich {pid}: {e}")
        await normalize_scores()
        await assign_trend_labels()
        logger.info(f"Rescored {len(enriched_ids)} papers after enrichment")


async def fetch_and_store_papers(days: int = 1):
    """Fetch from arXiv and store new papers. New papers get display_week = current+1."""
    logger.info(f"Fetching papers for last {days} days…")

    total = await turso_db.count("papers")
    if total == 0 and days == 1:
        logger.info("Empty DB → 30-day initial fetch")
        days = settings.INITIAL_FETCH_DAYS

    # Create log entry at the very start so admin can see fetch is running
    await turso_db.execute(
        "INSERT INTO analysis_log (run_type, status, notes) VALUES ('daily_fetch', 'running', ?)",
        [f"Fetching {days} day(s) of arXiv papers…"]
    )
    log_row = await turso_db.fetchone("SELECT rowid as id FROM analysis_log ORDER BY rowid DESC LIMIT 1")
    log_id = log_row["id"] if log_row else 0

    raw_papers = await fetch_papers_for_date_range(days=days)
    keywords = await _get_keywords()
    current_week = await _current_week_number()
    display_week = current_week + 1  # New papers show next week
    new_count = 0
    now = datetime.now(timezone.utc).isoformat()

    await turso_db.execute(
        "UPDATE analysis_log SET status='storing', notes=? WHERE id=?",
        [f"Got {len(raw_papers)} from arXiv, storing new ones…", log_id]
    )

    for p in raw_papers:
        try:
            existing = await turso_db.fetchone("SELECT arxiv_id FROM papers WHERE arxiv_id = ?", [p["arxiv_id"]])
            if existing:
                continue

            text = f"{p.get('title', '')} {p.get('abstract', '')}"
            kw_score = compute_tfidf_keyword_score(text, keywords)
            hash_id = hashlib.sha256(p["arxiv_id"].encode()).hexdigest()

            await turso_db.execute(
                """INSERT INTO papers (
                    arxiv_id, hash_id, title, abstract, authors, categories,
                    primary_category, published_at, updated_at, pdf_url, html_url,
                    doi, journal_ref, keyword_score, display_week, created_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                [p["arxiv_id"], hash_id, p["title"], p.get("abstract", ""),
                 json.dumps(p.get("authors", [])), json.dumps(p.get("categories", [])),
                 p.get("primary_category", "cs.AI"),
                 p.get("published_at"), p.get("updated_at"),
                 p.get("pdf_url"), p.get("html_url"),
                 p.get("doi"), p.get("journal_ref"),
                 kw_score, display_week, now]
            )
            new_count += 1

            if new_count % 50 == 0:
                logger.info(f"  Stored {new_count} papers…")
                await turso_db.execute(
                    "UPDATE analysis_log SET total_papers=?, notes=? WHERE id=?",
                    [new_count, f"Stored {new_count} papers so far…", log_id]
                )

        except Exception as e:
            logger.error(f"Store error {p.get('arxiv_id')}: {e}")

    logger.info(f"Stored {new_count} new papers (display_week={display_week})")

    if new_count > 0:
        await turso_db.execute(
            "UPDATE analysis_log SET total_papers=?, status='enriching', notes=? WHERE id=?",
            [new_count, f"Stored {new_count} papers, enriching citations/GitHub…", log_id]
        )
        # Enrich first (adds citation count, github stars) then score so those values are factored in
        await enrich_pending_papers(batch_size=min(new_count, 50))

        await turso_db.execute(
            "UPDATE analysis_log SET status='scoring', notes=? WHERE id=?",
            [f"Enriched, now scoring {new_count} papers…", log_id]
        )
        from app.tasks.analysis import score_all_papers, normalize_scores, assign_trend_labels
        await score_all_papers(log_id, force=False)
        await normalize_scores()
        await assign_trend_labels()

        # Count how many new papers ended up scored today
        scored_today = await turso_db.count(
            "papers", "date(created_at) = date('now') AND current_score > 0 AND is_deleted = 0"
        )
        await turso_db.execute(
            "UPDATE analysis_log SET status='complete', finished_at=datetime('now'), "
            "total_papers=?, scored_papers=?, notes=? WHERE id=?",
            [new_count, scored_today,
             f"Done: {new_count} fetched, {scored_today} scored, display_week={display_week}", log_id]
        )
        logger.info(f"Daily fetch pipeline complete: {new_count} papers fetched, {scored_today} scored")
    else:
        await turso_db.execute(
            "UPDATE analysis_log SET status='complete', finished_at=datetime('now'), "
            "total_papers=0, scored_papers=0, notes='No new papers found' WHERE id=?",
            [log_id]
        )


async def process_single_paper(arxiv_id: str):
    paper_data = await fetch_single_paper(arxiv_id)
    if not paper_data:
        return

    existing = await turso_db.fetchone("SELECT arxiv_id FROM papers WHERE arxiv_id = ?", [arxiv_id])
    if existing:
        return

    keywords = await _get_keywords()
    text = f"{paper_data.get('title', '')} {paper_data.get('abstract', '')}"
    kw_score = compute_tfidf_keyword_score(text, keywords)
    hash_id = hashlib.sha256(arxiv_id.encode()).hexdigest()
    now = datetime.now(timezone.utc).isoformat()
    current_week = await _current_week_number()

    await turso_db.execute(
        """INSERT INTO papers (arxiv_id, hash_id, title, abstract, authors, categories,
            primary_category, published_at, pdf_url, keyword_score, display_week, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        [arxiv_id, hash_id, paper_data["title"], paper_data.get("abstract", ""),
         json.dumps(paper_data.get("authors", [])), json.dumps(paper_data.get("categories", [])),
         paper_data.get("primary_category", "cs.AI"), paper_data.get("published_at"),
         paper_data.get("pdf_url"), kw_score, current_week + 1, now]
    )

    await enrich_pending_papers(batch_size=1)
    await score_existing_papers()
