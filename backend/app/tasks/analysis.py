"""
Initial data analysis pipeline.

Steps:
  1. Inspect existing data (tables, columns, row counts)
  2. Deduplicate (by arxiv_id, then by normalized title)
  3. Score ALL papers using TF-IDF + Gemini Flash Lite (via OpenRouter)
  4. Normalize scores globally (0-1)
  5. Mark papers above threshold as is_above_threshold = 1
  6. Assign display_week = 1 to all existing papers
  7. Set system start date
  8. Log analysis results

This runs on first startup. It is IDEMPOTENT – safe to run multiple times.
"""

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import List, Dict

from app.core.turso import db as turso_db
from app.core.database import get_system_config, set_system_config
from app.core.config import settings
from app.services.scorer import compute_score, normalize_batch, trend_label
from app.services.ai_service import AIValidationService, compute_tfidf_keyword_score, AI_KEYWORDS

logger = logging.getLogger(__name__)

SCORE_THRESHOLD = 0.25      # normalized_score above this → is_above_threshold = 1
AI_CONCURRENCY = 5          # max concurrent OpenRouter calls
BATCH_SIZE = 50             # papers per scoring batch


def _normalize_title(title: str) -> str:
    """Normalize title for duplicate detection."""
    t = title.lower().strip()
    t = re.sub(r"[^\w\s]", "", t)
    t = re.sub(r"\s+", " ", t)
    return t[:120]          # first 120 chars


async def _get_keywords() -> List[str]:
    rows = await turso_db.fetchall("SELECT keyword FROM keywords WHERE is_active = 1")
    extras = [r["keyword"] for r in rows]
    combined = extras + AI_KEYWORDS if extras else AI_KEYWORDS
    seen: set = set()
    result = []
    for kw in combined:
        key = kw.lower().strip()
        if key not in seen:
            seen.add(key)
            result.append(kw)
    return result


# ── Step 1: Inspect ──────────────────────────────────────────────────────────

async def inspect_database() -> Dict:
    """Inspect the existing database and return stats."""
    tables = await turso_db.get_tables()
    stats: Dict = {"tables": tables}

    if "papers" in tables:
        cols = await turso_db.get_columns("papers")
        total = await turso_db.count("papers")
        scored = await turso_db.count("papers", "current_score > 0")
        unscored = total - scored
        duplicates = await turso_db.count("papers", "is_duplicate = 1") if "is_duplicate" in cols else 0

        stats.update({
            "columns": cols,
            "total_papers": total,
            "scored_papers": scored,
            "unscored_papers": unscored,
            "duplicate_papers": duplicates,
        })
        logger.info(f"Database: {total} papers | {scored} scored | {unscored} unscored | {duplicates} duplicates")
    else:
        stats["total_papers"] = 0
        logger.warning("No 'papers' table found yet")

    return stats


# ── Step 2: Deduplicate ───────────────────────────────────────────────────────

async def deduplicate_papers() -> int:
    """
    Mark duplicate papers (is_duplicate=1).
    Strategy: detect near-duplicate titles (normalized).
    Note: arxiv_id is PRIMARY KEY so exact duplicates can't exist.
    Returns number of duplicates marked.
    """
    logger.info("Running deduplication…")
    dup_count = 0

    # Near-duplicate titles (same normalized first 80 chars)
    all_papers = await turso_db.fetchall(
        "SELECT rowid as id, title FROM papers WHERE is_duplicate = 0 AND is_deleted = 0"
    )
    seen_titles: Dict[str, int] = {}
    for p in all_papers:
        norm = _normalize_title(p.get("title") or "")[:80]
        if not norm:
            continue
        if norm in seen_titles:
            await turso_db.execute(
                "UPDATE papers SET is_duplicate = 1 WHERE rowid = ?", [p["id"]]
            )
            dup_count += 1
        else:
            seen_titles[norm] = p["id"]

    logger.info(f"Deduplication complete: {dup_count} duplicates marked")
    return dup_count


# ── Step 3 & 4: Score + Normalize ────────────────────────────────────────────

async def score_all_papers(log_id: int, force: bool = False) -> int:
    """
    Score all unscored (or all if force=True) papers.
    Uses Gemini Flash Lite for AI validation with TF-IDF fallback.
    Returns number of papers scored.
    """
    where = "is_duplicate = 0 AND is_deleted = 0"
    if not force:
        where += " AND (current_score IS NULL OR current_score = 0)"

    total = await turso_db.count("papers", where)
    if total == 0:
        logger.info("No papers to score.")
        return 0

    logger.info(f"Scoring {total} papers (force={force})…")
    await turso_db.execute(
        "UPDATE analysis_log SET total_papers = ? WHERE id = ?", [total, log_id]
    )

    keywords = await _get_keywords()
    ai_svc = AIValidationService(settings.OPENROUTER_API_KEY)
    semaphore = asyncio.Semaphore(AI_CONCURRENCY)
    now = datetime.now(timezone.utc).isoformat()
    scored_count = 0
    offset = 0

    while True:
        batch = await turso_db.fetchall(
            f"SELECT rowid as id, * FROM papers WHERE {where} ORDER BY rowid LIMIT ? OFFSET ?",
            [BATCH_SIZE, offset]
        )
        if not batch:
            break

        tasks = [_score_paper(p, ai_svc, keywords, semaphore, now) for p in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for r in results:
            if not isinstance(r, Exception):
                scored_count += 1

        offset += BATCH_SIZE
        logger.info(f"  Progress: {min(offset, total)}/{total} scored")
        await turso_db.execute(
            "UPDATE analysis_log SET scored_papers = ? WHERE id = ?", [scored_count, log_id]
        )
        await asyncio.sleep(0.5)  # brief pause between batches

    logger.info(f"Scoring complete: {scored_count} papers scored")
    return scored_count


async def _score_paper(paper: Dict, ai_svc: AIValidationService, keywords: List[str],
                        semaphore: asyncio.Semaphore, now: str):
    """Score a single paper."""
    async with semaphore:
        try:
            text = f"{paper.get('title', '')} {paper.get('abstract', '')}"
            kw_score = compute_tfidf_keyword_score(text, keywords)

            # Use existing AI scores if already validated
            ai_relevance = float(paper.get("ai_relevance_score") or 0)
            ai_impact = float(paper.get("ai_impact_score") or 0)
            ai_tags = paper.get("ai_topic_tags") or "[]"
            ai_summary = paper.get("ai_summary") or ""
            hook_text = paper.get("hook_text") or ""

            if ai_relevance == 0:
                if settings.OPENROUTER_API_KEY:
                    result = await ai_svc.validate_paper(
                        paper.get("title", ""),
                        paper.get("abstract", ""),
                        keywords
                    )
                else:
                    result = ai_svc._tfidf_fallback(
                        paper.get("title", ""),
                        paper.get("abstract", ""),
                        keywords
                    )
                ai_relevance = result.get("ai_relevance_score", kw_score)
                ai_impact = result.get("ai_impact_score", kw_score * 0.8)
                ai_tags = json.dumps(result.get("ai_topic_tags", []))
                ai_summary = result.get("ai_summary", "")
                hook_text = result.get("hook", "")

            enriched = dict(paper)
            enriched["ai_relevance_score"] = ai_relevance
            enriched["ai_impact_score"] = ai_impact
            enriched["keyword_score"] = kw_score

            score, score_type = compute_score(enriched)

            await turso_db.execute(
                """UPDATE papers SET
                    current_score = ?, score_type = ?, keyword_score = ?,
                    ai_relevance_score = ?, ai_impact_score = ?,
                    ai_topic_tags = ?, ai_summary = ?, hook_text = ?,
                    is_ai_validated = 1, last_scored_at = ?
                WHERE rowid = ?""",
                [score, score_type, kw_score, ai_relevance, ai_impact,
                 ai_tags, ai_summary, hook_text, now, paper["id"]]
            )

            await turso_db.execute(
                "INSERT INTO score_history (paper_id, score, score_type, scr_value) VALUES (?, ?, ?, 0)",
                [paper["id"], score, score_type]
            )
        except Exception as e:
            logger.error(f"Score error paper {paper.get('id')}: {e}")
            raise


async def normalize_scores() -> None:
    """Re-compute normalized_score (0-1 range) across all non-deleted papers."""
    rows = await turso_db.fetchall(
        "SELECT rowid as id, current_score FROM papers WHERE is_deleted = 0 AND is_duplicate = 0"
    )
    if not rows:
        return

    data = [{"id": r["id"], "current_score": float(r.get("current_score") or 0)} for r in rows]
    data = normalize_batch(data)

    # Batch updates in groups of 100
    CHUNK = 100
    for i in range(0, len(data), CHUNK):
        stmts = [
            ("UPDATE papers SET normalized_score = ?, is_above_threshold = ? WHERE rowid = ?",
             [p["normalized_score"], 1 if p["normalized_score"] >= SCORE_THRESHOLD else 0, p["id"]])
            for p in data[i:i+CHUNK]
        ]
        try:
            await turso_db.execute_many(stmts)
        except Exception:
            # Fallback: one by one
            for stmt, params in stmts:
                try:
                    await turso_db.execute(stmt, params)
                except Exception as e:
                    logger.error(f"Normalize error: {e}")

    above = sum(1 for p in data if p["normalized_score"] >= SCORE_THRESHOLD)
    logger.info(f"Normalized {len(data)} papers | {above} above threshold ({SCORE_THRESHOLD})")


# ── Step 5: Assign display_week ───────────────────────────────────────────────

async def assign_display_weeks(system_start: str) -> None:
    """
    Assign display_week to all papers:
    - Papers already in DB at system start → display_week = 1
    - Papers fetched later get display_week = current_week+1 (assigned at fetch time)
    """
    start_dt = datetime.fromisoformat(system_start.replace("Z", "+00:00"))
    if start_dt.tzinfo is None:
        from datetime import timezone
        start_dt = start_dt.replace(tzinfo=timezone.utc)

    # All existing papers get display_week = 1 (visible from day 1)
    await turso_db.execute(
        "UPDATE papers SET display_week = 1 WHERE display_week IS NULL OR display_week = 0"
    )
    logger.info("Assigned display_week = 1 to all existing papers")


# ── Step 6: Trend labels ──────────────────────────────────────────────────────

async def assign_trend_labels() -> None:
    """Assign trend labels to top-scoring papers."""
    # Top 5% by normalized_score → trending
    rows = await turso_db.fetchall(
        "SELECT rowid as id, normalized_score, scr_value, view_count FROM papers "
        "WHERE is_deleted = 0 AND is_duplicate = 0 AND normalized_score > 0 "
        "ORDER BY normalized_score DESC"
    )
    if not rows:
        return

    total = len(rows)
    top5_threshold = rows[int(total * 0.05)]["normalized_score"] if total > 20 else 0.8
    top15_threshold = rows[int(total * 0.15)]["normalized_score"] if total > 20 else 0.65
    top30_threshold = rows[int(total * 0.30)]["normalized_score"] if total > 20 else 0.5

    for p in rows:
        ns = float(p.get("normalized_score") or 0)
        views = int(p.get("view_count") or 0)
        scr = float(p.get("scr_value") or 0)

        if ns >= top5_threshold:
            label = "🔥 Trending"
            is_trending = 1
        elif ns >= top15_threshold:
            label = "📈 Rising"
            is_trending = 0
        elif ns >= top30_threshold and views < 10:
            label = "💎 Hidden Gem"
            is_trending = 0
        else:
            label = None
            is_trending = 0

        if label:
            await turso_db.execute(
                "UPDATE papers SET trend_label = ?, is_trending = ? WHERE rowid = ?",
                [label, is_trending, p["id"]]
            )


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def run_full_analysis(force_rescore: bool = False) -> Dict:
    """
    Full analysis pipeline. Idempotent – safe to re-run.
    Returns summary dict.
    """
    logger.info("=" * 60)
    logger.info("  Starting Full Data Analysis Pipeline")
    logger.info("=" * 60)

    # Create log entry
    await turso_db.execute(
        "INSERT INTO analysis_log (run_type, status) VALUES ('full_analysis', 'running')"
    )
    log_row = await turso_db.fetchone(
        "SELECT rowid as id FROM analysis_log ORDER BY rowid DESC LIMIT 1"
    )
    log_id = log_row["id"] if log_row else 0

    try:
        # 1. Inspect
        stats = await inspect_database()
        total = stats.get("total_papers", 0)

        if total == 0:
            logger.info("No papers in database yet – skipping analysis")
            await turso_db.execute(
                "UPDATE analysis_log SET status = 'skipped', finished_at = datetime('now'), notes = 'Empty database' WHERE id = ?",
                [log_id]
            )
            return {"status": "skipped", "reason": "empty_database"}

        # 2. Deduplicate
        dups = await deduplicate_papers()

        # 3. Score
        scored = await score_all_papers(log_id, force=force_rescore)

        # 4. Normalize
        await normalize_scores()

        # 5. Assign display_week
        system_start = await get_system_config("SYSTEM_START_DATE")
        if not system_start:
            system_start = datetime.now(timezone.utc).isoformat()
            await set_system_config("SYSTEM_START_DATE", system_start, "Date when system was first started")
        await assign_display_weeks(system_start)

        # 6. Trend labels
        await assign_trend_labels()

        # 7. Mark analysis complete
        above_threshold = await turso_db.count("papers", "is_above_threshold = 1 AND is_deleted = 0 AND is_duplicate = 0")
        trending_count = await turso_db.count("papers", "is_trending = 1 AND is_deleted = 0")

        summary = {
            "status": "complete",
            "total_papers": total,
            "scored": scored,
            "duplicates_removed": dups,
            "above_threshold": above_threshold,
            "trending": trending_count,
        }

        await turso_db.execute(
            "UPDATE analysis_log SET status = 'complete', scored_papers = ?, duplicates_removed = ?, finished_at = datetime('now'), notes = ? WHERE id = ?",
            [scored, dups, json.dumps(summary), log_id]
        )

        await set_system_config("ANALYSIS_COMPLETE", "1", "Whether initial analysis has been run")
        await set_system_config(
            "ANALYSIS_SUMMARY",
            json.dumps(summary),
            "Last analysis summary"
        )

        logger.info("=" * 60)
        logger.info(f"  Analysis complete: {total} papers | {scored} scored | {dups} dupes | {above_threshold} above threshold")
        logger.info("=" * 60)
        return summary

    except Exception as e:
        logger.error(f"Analysis pipeline error: {e}", exc_info=True)
        await turso_db.execute(
            "UPDATE analysis_log SET status = 'error', finished_at = datetime('now'), notes = ? WHERE id = ?",
            [str(e), log_id]
        )
        return {"status": "error", "error": str(e)}
