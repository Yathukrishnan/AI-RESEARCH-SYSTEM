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
    combined = extras + AI_KEYWORDS if extras else AI_KEYWORDS
    # Deduplicate while preserving order (DB keywords first, then AI_KEYWORDS extras)
    seen = set()
    result = []
    for kw in combined:
        key = kw.lower().strip()
        if key not in seen:
            seen.add(key)
            result.append(kw)
    return result


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

    # Re-queue enrichment for old papers (>30 days) that have 0 citations and 0 github data.
    # They may have been rate-limited (429) or not yet indexed in Semantic Scholar when first enriched.
    # Re-checking weekly gives them a chance to accumulate real citation data over time.
    reset_result = await turso_db.execute(
        "UPDATE papers SET is_enriched = 0, last_enriched_at = NULL "
        "WHERE is_enriched = 1 AND citation_count = 0 AND github_stars = 0 AND github_url IS NULL "
        "AND is_deleted = 0 "
        "AND date(COALESCE(published_at, published_date, '2020-01-01')) <= date('now', '-30 days')"
    )
    reset_count = reset_result.get("rows_affected", 0) if reset_result else 0
    if reset_count:
        logger.info(f"Weekly: reset {reset_count} old papers (>30d, zero citations) for re-enrichment")

    await normalize_scores()
    await assign_trend_labels()
    logger.info("Weekly rescore complete")


def _paper_age_days(published_at_str) -> float:
    """Return age in days from published_at string. Returns 30 if unknown."""
    if not published_at_str:
        return 30.0
    try:
        pub = datetime.fromisoformat(str(published_at_str).replace("Z", "+00:00"))
        if pub.tzinfo is None:
            pub = pub.replace(tzinfo=timezone.utc)
        return max(0.0, (datetime.now(timezone.utc) - pub).total_seconds() / 86400)
    except Exception:
        return 30.0


async def enrich_pending_papers(batch_size: int = 500):
    from app.services.enrichment_service import SS_BATCH_SIZE, SS_CHUNK_DELAY

    # Old papers (>7 days) first — citation_count affects their score.
    # New papers (≤7 days) last — they use keyword/recency/github, not citations yet.
    rows = await turso_db.fetchall(
        "SELECT rowid as id, arxiv_id, title, COALESCE(published_at, published_date) as published_at "
        "FROM papers WHERE is_enriched = 0 AND is_deleted = 0 "
        "ORDER BY "
        "  CASE WHEN date(COALESCE(published_at, published_date, '2020-01-01')) <= date('now', '-7 days') "
        "       THEN 0 ELSE 1 END ASC, "
        "  COALESCE(normalized_score, current_score, keyword_score, 0) DESC "
        "LIMIT ?",
        [batch_size]
    )
    if not rows:
        logger.info("Enrich: no pending papers")
        return

    enricher = EnrichmentService(settings.SEMANTIC_SCHOLAR_API_URL, settings.PAPERS_WITH_CODE_API_URL)
    now = datetime.now(timezone.utc).isoformat()
    enriched_ids = []

    # Split into old (>7 days) and new (≤7 days)
    old_papers = [p for p in rows if _paper_age_days(p.get("published_at")) > 7]
    new_papers = [p for p in rows if _paper_age_days(p.get("published_at")) <= 7]
    logger.info(
        f"Enriching {len(rows)} papers: {len(old_papers)} old (citations+GitHub), "
        f"{len(new_papers)} new (GitHub only)…"
    )

    # ── Old papers: full enrichment in SS_BATCH_SIZE chunks ─────────────────
    # Each chunk: 1 SS paper batch call + 1 SS author batch call + N concurrent PwC calls
    # SS + PwC run in parallel (asyncio.gather), then SS_CHUNK_DELAY between chunks
    for chunk_start in range(0, len(old_papers), SS_BATCH_SIZE):
        chunk = old_papers[chunk_start:chunk_start + SS_BATCH_SIZE]
        chunk_arxiv_ids = [p["arxiv_id"] for p in chunk]

        # Run SS batch and PwC concurrent calls in parallel
        ss_map, github_map = await asyncio.gather(
            enricher.get_semantic_scholar_batch(chunk_arxiv_ids),
            enricher.get_github_data_concurrent(chunk),
        )

        for p in chunk:
            aid = p["arxiv_id"]
            ss = ss_map.get(aid) or {}
            gh = github_map.get(aid) or {}

            citation_count = int(ss.get("citation_count") or 0)
            influential_citation_count = int(ss.get("influential_citation_count") or 0)
            h_index = float(ss.get("h_index_max") or 0.0)
            github_url = gh.get("github_url")
            github_stars = int(gh.get("github_stars") or 0)
            github_forks = int(gh.get("github_forks") or 0)

            try:
                await turso_db.execute(
                    "UPDATE papers SET citation_count=?, influential_citation_count=?, "
                    "h_index_max=?, github_url=?, "
                    "github_stars=?, github_forks=?, is_enriched=1, last_enriched_at=? WHERE rowid=?",
                    [citation_count, influential_citation_count, h_index,
                     github_url, github_stars, github_forks, now, p["id"]]
                )
                enriched_ids.append(p["id"])
                logger.debug(f"Enriched {aid}: citations={citation_count}, stars={github_stars}")
            except Exception as e:
                logger.error(f"DB update error {aid}: {e}")

        # Rate-limit pause between SS batch chunks (skip after last chunk)
        if chunk_start + SS_BATCH_SIZE < len(old_papers):
            await asyncio.sleep(SS_CHUNK_DELAY)

    # ── New papers: GitHub only, SS deferred until paper is >7 days old ─────
    new_github_ids = []  # papers that got github_stars > 0 — need rescore
    for chunk_start in range(0, len(new_papers), 50):
        chunk = new_papers[chunk_start:chunk_start + 50]
        github_map = await enricher.get_github_data_concurrent(chunk)

        for p in chunk:
            gh = github_map.get(p["arxiv_id"]) or {}
            github_url = gh.get("github_url")
            github_stars = int(gh.get("github_stars") or 0)
            github_forks = int(gh.get("github_forks") or 0)

            try:
                await turso_db.execute(
                    "UPDATE papers SET github_url=?, github_stars=?, github_forks=?, "
                    "last_enriched_at=? WHERE rowid=?",
                    [github_url, github_stars, github_forks, now, p["id"]]
                )
                if github_stars > 0 or github_url:
                    logger.debug(f"New paper {p['arxiv_id']}: GitHub stars={github_stars}, SS deferred")
                    new_github_ids.append(p["id"])
            except Exception as e:
                logger.error(f"DB update error (new) {p['arxiv_id']}: {e}")
            # Don't add to enriched_ids — keep is_enriched=0 so SS runs later

    logger.info(
        f"Enriched {len(enriched_ids)} old papers, {len(new_papers)} new papers (GitHub only); "
        f"{len(new_github_ids)} new papers have GitHub stars → rescoring"
    )

    # Rescore all papers that received new data so scores reflect stars/citations immediately
    all_rescore_ids = enriched_ids + new_github_ids
    if all_rescore_ids:
        from app.tasks.analysis import normalize_scores, assign_trend_labels
        from app.services.scorer import compute_score
        now_dt = datetime.now(timezone.utc)
        for pid in all_rescore_ids:
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
        logger.info(f"Rescored {len(enriched_ids)} old + {len(new_github_ids)} new (with GitHub stars) papers")


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
        # ── Step 1: AI score first ──────────────────────────────────────────
        # Must run BEFORE enrichment so ai_relevance_score / ai_impact_score are
        # written to DB. The enrichment rescore (step 2) then reads those values
        # and produces a full score: AI + citations + GitHub.
        # If we enriched first, papers would get current_score > 0 from citations
        # alone, and score_all_papers(force=False) would skip them permanently.
        await turso_db.execute(
            "UPDATE analysis_log SET status='scoring', notes=? WHERE id=?",
            [f"Scoring {new_count} papers with AI validation…", log_id]
        )
        from app.tasks.analysis import score_all_papers, normalize_scores, assign_trend_labels
        await score_all_papers(log_id, force=False)

        # ── Step 2: Enrich (citations + GitHub) then rescore ────────────────
        # Now ai_relevance_score is set, so the rescore inside enrich_pending_papers
        # produces current_score = AI relevance + citations + GitHub + recency/decay.
        await turso_db.execute(
            "UPDATE analysis_log SET status='enriching', notes=? WHERE id=?",
            [f"AI scored, now enriching citations/GitHub for {new_count} papers…", log_id]
        )
        await enrich_pending_papers(batch_size=min(new_count, 50))

        # ── Step 3: Final normalize pass (covers papers not in enrich batch) ─
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


async def generate_missing_hooks(batch_size: int = 500, force: bool = False) -> int:
    """
    Generate hook_text for papers.
    force=True: reset ALL existing hooks and regenerate (use new prompt style).
    force=False: only fill papers where hook_text is NULL/empty.
    """
    if force:
        # Wipe all existing hooks so everything gets regenerated with current prompt
        await turso_db.execute(
            "UPDATE papers SET hook_text = NULL WHERE is_deleted = 0 AND is_duplicate = 0"
        )
        logger.info("Hook gen: wiped all existing hooks — regenerating all…")

    rows = await turso_db.fetchall(
        "SELECT rowid as id, title, abstract FROM papers "
        "WHERE (hook_text IS NULL OR hook_text = '') "
        "AND is_deleted = 0 AND is_duplicate = 0 "
        "ORDER BY normalized_score DESC "
        "LIMIT ?",
        [batch_size]
    )
    if not rows:
        logger.info("Hook gen: no papers need hooks.")
        return 0

    logger.info(f"Hook gen: generating for {len(rows)} papers (force={force})…")
    ai_svc = AIValidationService(settings.OPENROUTER_API_KEY)
    semaphore = asyncio.Semaphore(5)

    async def _gen(paper):
        async with semaphore:
            try:
                hook = await ai_svc.generate_hook_only(
                    paper.get("title", ""),
                    paper.get("abstract", "")
                )
                if hook:
                    await turso_db.execute(
                        "UPDATE papers SET hook_text = ? WHERE rowid = ?",
                        [hook, paper["id"]]
                    )
                    return True
            except Exception as e:
                logger.error(f"Hook gen error paper {paper.get('id')}: {e}")
            return False

    results = await asyncio.gather(*[_gen(p) for p in rows], return_exceptions=True)
    count = sum(1 for r in results if r is True)
    logger.info(f"Hook gen: done — {count}/{len(rows)} hooks generated")
    return count


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
