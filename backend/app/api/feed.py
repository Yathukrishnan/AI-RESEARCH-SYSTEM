"""
Feed API – weekly rotation with daily 20-paper offset.

Weekly logic:
  - current_week = days since SYSTEM_START_DATE // 7 + 1
  - Papers with display_week <= current_week are visible
  - Daily rotation: offset = (day_of_year % total_pages) * PAGE_SIZE
  - Only papers with is_above_threshold = 1 appear in main sections
"""

import json
import uuid
from datetime import datetime, timezone, date
from typing import Optional

from fastapi import APIRouter, Depends, Query, Header
from app.core.turso import TursoClient, get_db
from app.core.database import get_system_config
from app.core.redis_client import cache_get, cache_set
from app.services.alert_engine import generate_alerts

router = APIRouter(tags=["feed"])

PAGE_SIZE = 20


def _parse(p: dict) -> dict:
    for f in ("authors", "categories", "ai_topic_tags"):
        v = p.get(f)
        if isinstance(v, str):
            try:
                p[f] = json.loads(v)
            except Exception:
                p[f] = []
        elif v is None:
            p[f] = []
    return p


async def _current_week(db: TursoClient) -> int:
    """How many weeks since system start (minimum 1)."""
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


def _daily_offset(pool_size: int) -> int:
    """Rotate which slice of the pool we show today."""
    if pool_size <= PAGE_SIZE:
        return 0
    day = datetime.now(timezone.utc).timetuple().tm_yday
    total_pages = pool_size // PAGE_SIZE
    return (day % total_pages) * PAGE_SIZE


@router.get("/feed")
async def get_feed(
    page: int = Query(0, ge=0),
    session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: TursoClient = Depends(get_db),
):
    if not session_id:
        session_id = str(uuid.uuid4())

    cache_key = f"feed:{page}:{date.today().isoformat()}"
    if page > 0:
        cached = await cache_get(cache_key)
        if cached:
            return cached

    current_week = await _current_week(db)
    base_where = "is_deleted = 0 AND is_duplicate = 0 AND display_week <= ?"
    base_params = [current_week]

    sections = []

    # ── Trending ─────────────────────────────────────────────────────────
    trending = await db.fetchall(
        f"SELECT rowid as id, * FROM papers WHERE {base_where} AND is_trending = 1 "
        f"ORDER BY normalized_score DESC LIMIT 8",
        base_params
    )
    if trending:
        sections.append({
            "section_type": "trending",
            "title": "🔥 Trending Now",
            "emoji": "🔥",
            "papers": [_parse(p) for p in trending],
            "total": len(trending),
        })

    # ── Rising ─────────────────────────────────────────────────────────
    rising = await db.fetchall(
        f"SELECT rowid as id, * FROM papers WHERE {base_where} AND is_trending = 0 "
        f"AND trend_label IS NOT NULL AND trend_label LIKE '%Rising%' "
        f"ORDER BY normalized_score DESC LIMIT 8",
        base_params
    )
    if rising:
        sections.append({
            "section_type": "rising",
            "title": "📈 Rising Fast",
            "emoji": "📈",
            "papers": [_parse(p) for p in rising],
            "total": len(rising),
        })

    # ── Hidden Gems ────────────────────────────────────────────────────
    gems = await db.fetchall(
        f"SELECT rowid as id, * FROM papers WHERE {base_where} AND is_above_threshold = 1 "
        f"AND trend_label LIKE '%Hidden%' "
        f"ORDER BY normalized_score DESC LIMIT 6",
        base_params
    )
    if gems:
        sections.append({
            "section_type": "hidden_gems",
            "title": "💎 Hidden Gems",
            "emoji": "💎",
            "papers": [_parse(p) for p in gems],
            "total": len(gems),
        })

    # ── Top Daily Rotation ──────────────────────────────────────────────
    # Get pool count for rotation offset
    pool_count = await db.count(
        "papers",
        "is_deleted = 0 AND is_duplicate = 0 AND is_above_threshold = 1 AND display_week <= " + str(current_week)
    )
    daily_offset = _daily_offset(pool_count) + (page * PAGE_SIZE)

    top_papers = await db.fetchall(
        f"SELECT rowid as id, * FROM papers WHERE {base_where} AND is_above_threshold = 1 "
        f"ORDER BY normalized_score DESC LIMIT ? OFFSET ?",
        base_params + [PAGE_SIZE, daily_offset]
    )
    if top_papers:
        sections.append({
            "section_type": "new",
            "title": "⭐ Top Picks Today",
            "emoji": "⭐",
            "papers": [_parse(p) for p in top_papers],
            "total": pool_count,
        })

    # ── Latest Added ────────────────────────────────────────────────────
    latest = await db.fetchall(
        f"SELECT rowid as id, * FROM papers WHERE {base_where} AND is_above_threshold = 1 "
        f"ORDER BY COALESCE(published_at, published_date) DESC LIMIT 8",
        base_params
    )
    if latest:
        sections.append({
            "section_type": "new",
            "title": "🆕 Just Published",
            "emoji": "🆕",
            "papers": [_parse(p) for p in latest],
            "total": len(latest),
        })

    # ── You Might Have Missed ──────────────────────────────────────────
    you_missed = await db.fetchall(
        "SELECT rowid as id, * FROM papers WHERE is_deleted = 0 AND is_duplicate = 0 "
        "AND is_above_threshold = 1 AND normalized_score > 0.65 AND view_count < 15 "
        "ORDER BY normalized_score DESC LIMIT 6"
    )
    if you_missed:
        sections.append({
            "section_type": "you_missed",
            "title": "👀 You Might Have Missed",
            "emoji": "👀",
            "papers": [_parse(p) for p in you_missed],
            "total": len(you_missed),
        })

    # ── Personalized (session-based) ──────────────────────────────────
    if session_id and page == 0:
        recent_views = await db.fetchall(
            "SELECT paper_id FROM user_interactions WHERE session_id = ? AND action = 'view' "
            "ORDER BY created_at DESC LIMIT 10",
            [session_id]
        )
        if recent_views:
            viewed_ids = [r["paper_id"] for r in recent_views]
            cats_rows = await db.fetchall(
                f"SELECT primary_category FROM papers WHERE rowid IN ({','.join(['?']*len(viewed_ids))}) "
                "AND primary_category IS NOT NULL GROUP BY primary_category ORDER BY COUNT(*) DESC LIMIT 1",
                viewed_ids
            )
            if cats_rows and cats_rows[0].get("primary_category"):
                fav_cat = cats_rows[0]["primary_category"]
                not_in = ','.join(['?'] * len(viewed_ids))
                personalized = await db.fetchall(
                    f"SELECT rowid as id, * FROM papers WHERE is_deleted = 0 AND is_duplicate = 0 "
                    f"AND is_above_threshold = 1 AND primary_category = ? "
                    f"AND rowid NOT IN ({not_in}) "
                    "ORDER BY normalized_score DESC LIMIT 6",
                    [fav_cat] + viewed_ids
                )
                if personalized:
                    sections.append({
                        "section_type": "personalized",
                        "title": f"✨ More in {fav_cat}",
                        "emoji": "✨",
                        "papers": [_parse(p) for p in personalized],
                        "total": len(personalized),
                    })

    total_papers = await db.count("papers", "is_deleted = 0 AND is_duplicate = 0")
    alerts = []
    if page == 0:
        alerts = await generate_alerts(db)

    result = {
        "sections": sections,
        "current_week": current_week,
        "current_page": page,
        "has_more": pool_count > (daily_offset + PAGE_SIZE),
        "total_papers": total_papers,
        "above_threshold": pool_count,
        "alerts": alerts,
    }

    await cache_set(cache_key, result, ttl=300)
    return result


@router.get("/search")
async def search_papers(
    q: str = Query(..., min_length=2),
    page: int = Query(0, ge=0),
    limit: int = Query(20, le=50),
    db: TursoClient = Depends(get_db),
):
    like = f"%{q}%"
    offset = page * limit
    papers = await db.fetchall(
        "SELECT rowid as id, * FROM papers WHERE is_deleted = 0 AND is_duplicate = 0 "
        "AND (title LIKE ? OR abstract LIKE ?) "
        "ORDER BY normalized_score DESC LIMIT ? OFFSET ?",
        [like, like, limit, offset]
    )
    return {
        "query": q,
        "papers": [_parse(p) for p in papers],
        "page": page,
        "has_more": len(papers) == limit,
    }


@router.post("/interact/{paper_id}")
async def record_interaction(
    paper_id: int,
    action: str = Query(...),
    session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: TursoClient = Depends(get_db),
):
    col_map = {"view": "view_count", "save": "save_count", "click": "click_count"}
    col = col_map.get(action)
    if col:
        await db.execute(f"UPDATE papers SET {col} = {col} + 1 WHERE rowid = ?", [paper_id])
    await db.execute(
        "INSERT INTO user_interactions (session_id, paper_id, action) VALUES (?, ?, ?)",
        [session_id or "anon", paper_id, action]
    )
    return {"status": "ok"}


@router.post("/cron/daily-fetch")
async def cron_daily_fetch(db: TursoClient = Depends(get_db)):
    """
    Public cron endpoint — safe to call from cron-job.org or UptimeRobot.
    Only triggers the fetch if it hasn't already run successfully today.
    Point an external cron at POST /api/cron/daily-fetch at 02:35 UTC daily.
    """
    from datetime import datetime, timezone as tz
    import asyncio

    now = datetime.now(tz.utc)
    if not (now.hour > 2 or (now.hour == 2 and now.minute >= 30)):
        return {"status": "skipped", "reason": "before 02:30 UTC"}

    row = await db.fetchone(
        "SELECT id FROM analysis_log "
        "WHERE run_type = 'daily_fetch' AND status = 'complete' "
        "AND date(started_at) = date('now') ORDER BY id DESC LIMIT 1"
    )
    if row:
        return {"status": "skipped", "reason": "already ran today"}

    from app.tasks.paper_tasks import fetch_and_store_papers
    asyncio.create_task(fetch_and_store_papers(1))
    return {"status": "triggered"}


@router.get("/stats")
async def get_stats(db: TursoClient = Depends(get_db)):
    """Public stats endpoint for the feed header."""
    total = await db.count("papers", "is_deleted = 0 AND is_duplicate = 0")
    above = await db.count("papers", "is_above_threshold = 1 AND is_deleted = 0 AND is_duplicate = 0")
    trending = await db.count("papers", "is_trending = 1 AND is_deleted = 0")
    current_week = await _current_week(db)

    analysis_done = await db.fetchone("SELECT value FROM admin_config WHERE key = 'ANALYSIS_COMPLETE'")
    analysis_status = analysis_done.get("value") if analysis_done else "0"

    return {
        "total_papers": total,
        "visible_papers": above,
        "trending_papers": trending,
        "current_week": current_week,
        "analysis_complete": analysis_status == "1",
    }
