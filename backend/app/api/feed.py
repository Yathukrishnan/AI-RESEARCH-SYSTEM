"""
Feed API – weekly rotation with daily 20-paper offset.

Weekly logic:
  - current_week = days since SYSTEM_START_DATE // 7 + 1
  - Papers with display_week <= current_week are visible
  - Daily rotation: offset = (day_of_year % total_pages) * PAGE_SIZE
  - Only papers with is_above_threshold = 1 appear in main sections
"""

import hashlib
import json
import random
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
    """Week number anchored to Tuesdays. New week starts every Tuesday 00:00 UTC."""
    from datetime import timedelta
    start_str = await get_system_config("SYSTEM_START_DATE")
    if not start_str:
        return 1
    try:
        start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        # Find first Tuesday on or after system start (weekday 1 = Tuesday)
        days_to_tuesday = (1 - start.weekday()) % 7
        epoch = (start + timedelta(days=days_to_tuesday)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        now = datetime.now(timezone.utc)
        if now < epoch:
            return 1
        return max(1, (now.date() - epoch.date()).days // 7 + 1)
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
    # Search across title, abstract, authors (JSON text), categories, primary_category, topic tags
    papers = await db.fetchall(
        "SELECT rowid as id, * FROM papers WHERE is_deleted = 0 AND is_duplicate = 0 "
        "AND (title LIKE ? OR abstract LIKE ? OR authors LIKE ? "
        "     OR primary_category LIKE ? OR categories LIKE ? OR ai_topic_tags LIKE ?) "
        "ORDER BY normalized_score DESC LIMIT ? OFFSET ?",
        [like, like, like, like, like, like, limit, offset]
    )
    total = await db.fetchone(
        "SELECT COUNT(*) as cnt FROM papers WHERE is_deleted = 0 AND is_duplicate = 0 "
        "AND (title LIKE ? OR abstract LIKE ? OR authors LIKE ? "
        "     OR primary_category LIKE ? OR categories LIKE ? OR ai_topic_tags LIKE ?)",
        [like, like, like, like, like, like]
    )
    return {
        "query": q,
        "papers": [_parse(p) for p in papers],
        "page": page,
        "has_more": len(papers) == limit,
        "total": (total or {}).get("cnt", 0),
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


@router.get("/dashboard")
async def get_dashboard(db: TursoClient = Depends(get_db)):
    """
    Returns all 8 Intelligence Dashboard sections in one call.
    Cached 30 minutes. Full week's papers are available (no daily rotation cap).
    """
    import asyncio
    import logging
    _log = logging.getLogger(__name__)

    # Daily rotation: offset shifts each day so users see different papers
    from datetime import date as _date, timedelta
    today_str = _date.today().isoformat()
    day_num = _date.today().toordinal()  # unique int per calendar day

    try:
        cached = await cache_get(f"dashboard:v1:{today_str}")
        if cached:
            return cached
    except Exception:
        pass

    try:
        current_week = await _current_week(db)
    except Exception:
        current_week = 999  # show all papers if week calc fails

    W = "is_deleted = 0 AND is_duplicate = 0 AND is_above_threshold = 1 AND display_week <= ?"
    W_ALL = "is_deleted = 0 AND is_duplicate = 0 AND display_week <= ?"
    P = [current_week]
    cutoff_72h = (datetime.now(timezone.utc) - timedelta(hours=72)).isoformat()

    # Daily offsets — rotate which papers appear in each section each day
    hero_off    = day_num % 8          # cycle top 8 trending papers (1 shown)
    hype_off    = (day_num % 5) * 3    # 5 rotations × 3-paper shift
    radar_off   = (day_num % 4) * 5    # 4 rotations × 5-paper shift
    theory_off  = (day_num % 4) * 5
    contra_off  = (day_num % 3) * 4    # 3 rotations × 4-paper shift

    # ── Parallel fetch: all independent queries at once ────────────────────────
    async def safe_fetch(sql, params=None):
        try:
            return await db.fetchall(sql, params or [])
        except Exception as e:
            _log.warning(f"Dashboard query failed: {e}")
            return []

    (
        hero_rows, hype_rows, grid_rows, radar_rows,
        arsenal_rows, vel_rows, theory_rows, contrarian_rows
    ) = await asyncio.gather(
        # 1. Hero – must have HF upvotes OR HN points (real community discussion proof).
        #    Ranked by a blended score: 60% trending_score (social momentum) + 40% normalized_score
        #    (quality). This handles both established papers (high quality + moderate buzz) and
        #    emerging papers (lower quality score but viral community discussion) fairly.
        #    Rotates through top 8 qualifying papers daily so the hero changes each day.
        safe_fetch(
            f"SELECT rowid as id, * FROM papers WHERE {W} "
            "AND (COALESCE(hf_upvotes,0) > 0 OR COALESCE(hn_points,0) > 0) "
            "ORDER BY "
            "  (COALESCE(trending_score,0)*0.60 + COALESCE(normalized_score,0)*0.40) DESC, "
            "  COALESCE(citation_count,0) DESC "
            f"LIMIT 1 OFFSET {hero_off}", P),
        # 2. Hype Carousel – rotate social buzz papers daily
        safe_fetch(
            f"SELECT rowid as id, * FROM papers WHERE {W} "
            "AND (COALESCE(hf_upvotes,0) > 0 OR COALESCE(hn_points,0) > 0) "
            f"ORDER BY COALESCE(trending_score,0) DESC, normalized_score DESC LIMIT 5 OFFSET {hype_off}", P),
        # 3. Intelligence Grid – recent papers (no rotation, always newest)
        safe_fetch(
            f"SELECT rowid as id, * FROM papers WHERE {W} "
            "AND COALESCE(published_at, created_at) >= ? "
            "ORDER BY normalized_score DESC LIMIT 6", P + [cutoff_72h]),
        # 4. Under the Radar – rotate emerging researcher papers daily
        safe_fetch(
            f"SELECT rowid as id, * FROM papers WHERE {W} "
            "AND COALESCE(h_index_max,0) < 15 "
            f"ORDER BY normalized_score DESC LIMIT 5 OFFSET {radar_off}", P),
        # 5. Builder's Arsenal – github repos (stable ranking, no rotation)
        safe_fetch(
            f"SELECT rowid as id, * FROM papers WHERE {W} "
            "AND COALESCE(github_stars,0) > 0 "
            "ORDER BY github_stars DESC LIMIT 5", P),
        # 6. Velocity Desk – citation velocity (stable)
        safe_fetch(
            f"SELECT rowid as id, * FROM papers WHERE {W} "
            "AND COALESCE(citation_velocity,0) > 0 "
            "ORDER BY citation_velocity DESC LIMIT 3", P),
        # 7. Theory Corner – rotate pure-research papers daily
        safe_fetch(
            f"SELECT rowid as id, * FROM papers WHERE {W} "
            "AND COALESCE(github_stars,0) = 0 "
            f"ORDER BY normalized_score DESC LIMIT 5 OFFSET {theory_off}", P),
        # 8. Contrarian View – rotate non-mainstream papers daily
        safe_fetch(
            f"SELECT rowid as id, * FROM papers WHERE {W} "
            "AND primary_category NOT IN ('cs.LG','cs.AI','cs.CL','cs.CV','cs.NE','stat.ML') "
            f"ORDER BY normalized_score DESC LIMIT 4 OFFSET {contra_off}", P),
    )

    # ── Fallbacks for sparse sections ─────────────────────────────────────────
    top5 = await safe_fetch(
        f"SELECT rowid as id, * FROM papers WHERE {W} ORDER BY normalized_score DESC LIMIT 10", P)
    # If nothing passes threshold, try without threshold
    if not top5:
        top5 = await safe_fetch(
            f"SELECT rowid as id, * FROM papers WHERE {W_ALL} ORDER BY normalized_score DESC LIMIT 10", P)

    if not hero_rows and top5:
        hero_rows = [top5[0]]

    # Pad hype to 5 with top-scored papers not already in hype
    if len(hype_rows) < 5 and top5:
        seen = {p.get("id") for p in hype_rows}
        for p in top5:
            if len(hype_rows) >= 5:
                break
            if p.get("id") not in seen:
                hype_rows.append(p)
                seen.add(p.get("id"))

    if not grid_rows:
        grid_rows = await safe_fetch(
            f"SELECT rowid as id, * FROM papers WHERE {W} "
            "ORDER BY COALESCE(published_at, created_at) DESC LIMIT 6", P)
        if not grid_rows:
            grid_rows = top5[:6]

    if not radar_rows:
        radar_rows = top5[:5]

    if not vel_rows:
        vel_rows = top5[:3]

    if not theory_rows:
        theory_rows = top5[:5]

    if not contrarian_rows:
        contrarian_rows = top5[:4]

    # ── Velocity Desk: attach score history (parallel per paper) ──────────────
    async def fetch_with_history(p):
        pid = p.get("id")
        try:
            history = await db.fetchall(
                "SELECT score FROM score_history WHERE paper_id = ? ORDER BY scored_at ASC LIMIT 7",
                [pid]
            ) if pid else []
        except Exception:
            history = []
        parsed = _parse(dict(p))
        parsed["score_history"] = (
            [round(float(h["score"] or 0), 3) for h in history]
            or [round(float(parsed.get("normalized_score") or 0), 3)]
        )
        return parsed

    velocity_desk = list(await asyncio.gather(*[fetch_with_history(p) for p in vel_rows]))

    # ── AI-generated section hooks (parallel, one per section) ────────────────
    # Builder's Arsenal keeps hardcoded terminal-style hooks — skip it here.
    from app.services.ai_service import AIValidationService
    from app.core.config import settings
    ai = AIValidationService(settings.OPENROUTER_API_KEY)

    parsed_hero     = _parse(dict(hero_rows[0])) if hero_rows else None
    parsed_hype     = [_parse(dict(p)) for p in hype_rows]
    parsed_grid     = [_parse(dict(p)) for p in grid_rows]
    parsed_radar    = [_parse(dict(p)) for p in radar_rows]
    parsed_theory   = [_parse(dict(p)) for p in theory_rows]
    parsed_contra   = [_parse(dict(p)) for p in contrarian_rows]

    # Extract hero author data for the author-centric bio hook
    def _hero_author_args(hero) -> dict:
        if not hero:
            return {}
        authors = hero.get("authors") or []
        top = authors[0] if authors else {}
        return {
            "author_name":    top.get("name") or "",
            "h_index":        float(hero.get("h_index_max") or top.get("h_index") or 0),
            "title":          hero.get("title") or "",
            "abstract":       hero.get("abstract") or "",
            "hf_upvotes":     int(hero.get("hf_upvotes") or 0),
            "hn_points":      int(hero.get("hn_points") or 0),
            "citation_count": int(hero.get("citation_count") or 0),
        }

    (
        hook_hero, hook_hype, hook_grid, hook_radar,
        hook_velocity, hook_theory, hook_contra
    ) = await asyncio.gather(
        # Hero: author-centric bio hook generated by AI
        ai.generate_hero_author_hook(**_hero_author_args(parsed_hero)),
        ai.generate_section_hook("Hype Carousel",    parsed_hype),
        ai.generate_section_hook("Intelligence Grid", parsed_grid),
        ai.generate_section_hook("Under the Radar",  parsed_radar),
        ai.generate_section_hook("Velocity Desk",    velocity_desk),
        ai.generate_section_hook("Theory Corner",    parsed_theory),
        ai.generate_section_hook("Contrarian View",  parsed_contra),
    )

    result = {
        "hero": parsed_hero,
        "hype_carousel": parsed_hype,
        "intelligence_grid": parsed_grid,
        "under_the_radar": parsed_radar,
        "builders_arsenal": [_parse(dict(p)) for p in arsenal_rows],
        "velocity_desk": velocity_desk,
        "theory_corner": parsed_theory,
        "contrarian_view": parsed_contra,
        # AI-generated section hooks — empty string → frontend falls back to hardcoded
        "section_hooks": {
            "hero":             hook_hero,
            "hype_carousel":    hook_hype,
            "intelligence_grid": hook_grid,
            "under_the_radar":  hook_radar,
            "velocity_desk":    hook_velocity,
            "theory_corner":    hook_theory,
            "contrarian_view":  hook_contra,
        },
    }

    try:
        # Cache until midnight (max 30 min within the same day)
        await cache_set(f"dashboard:v1:{today_str}", result, ttl=1800)
    except Exception:
        pass

    return result


@router.get("/hooks/today")
async def get_daily_hooks(db: TursoClient = Depends(get_db)):
    """Returns today's rotating hooks for the headline banner."""
    from datetime import date as _date
    today = _date.today().isoformat()
    hooks = []
    try:
        hooks = await db.fetchall(
            "SELECT dh.id, dh.hook_text, dh.section_label, dh.hook_order, "
            "p.title, p.rowid as paper_id "
            "FROM daily_hooks dh JOIN papers p ON p.rowid = dh.paper_id "
            "WHERE dh.date = ? ORDER BY dh.hook_order ASC",
            [today]
        )
    except Exception:
        hooks = []
    # Fallback: pull from hook_text column on papers
    if not hooks:
        try:
            rows = await db.fetchall(
                "SELECT rowid as id, title, hook_text FROM papers "
                "WHERE hook_text IS NOT NULL AND hook_text != '' "
                "AND is_deleted = 0 "
                "ORDER BY normalized_score DESC LIMIT 15"
            )
            labels = ["🔥 Trending Papers", "💎 Hidden Gems", "⚡ Just Added", "📈 Rising Fast", "🔬 Deep Research"]
            hooks = [
                {"id": i, "hook_text": r["hook_text"], "section_label": labels[i % len(labels)],
                 "hook_order": i, "title": r["title"], "paper_id": r["id"]}
                for i, r in enumerate(rows)
            ]
        except Exception:
            hooks = []
    return {"date": today, "hooks": [dict(h) for h in hooks]}


@router.get("/papers/list")
async def get_papers_by_type(
    type: str = Query("trending"),
    page: int = Query(0, ge=0),
    db: TursoClient = Depends(get_db),
):
    """
    Returns paginated papers for a category page.
    type: trending | gems | new | rising | all
    """
    limit = 24
    offset = page * limit
    base = "is_deleted = 0 AND is_duplicate = 0"

    if type == "trending":
        where = f"{base} AND is_trending = 1"
        order = "normalized_score DESC"
        params: list = []
    elif type == "gems":
        # Good quality score, NOT trending, low community discovery
        # (low views in our system AND low/no HF upvotes)
        where = (
            f"{base} AND is_above_threshold = 1 "
            "AND (is_trending = 0 OR is_trending IS NULL) "
            "AND view_count < 50 "
            "AND (hf_upvotes IS NULL OR hf_upvotes < 10)"
        )
        order = "normalized_score DESC"
        params = []
    elif type == "new":
        from datetime import timedelta
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        where = f"{base} AND created_at > ?"
        order = "COALESCE(normalized_score, keyword_score, 0) DESC, created_at DESC"
        params = [since]
    elif type == "rising":
        where = (
            f"{base} AND is_above_threshold = 1 "
            "AND date(COALESCE(last_scored_at, created_at)) >= date('now', '-3 days')"
        )
        order = "normalized_score DESC"
        params = []
    else:
        where = f"{base} AND is_above_threshold = 1"
        order = "normalized_score DESC"
        params = []

    try:
        total = await db.count("papers", where, params or None)
        rows = await db.fetchall(
            f"SELECT rowid as id, * FROM papers WHERE {where} ORDER BY {order} LIMIT ? OFFSET ?",
            params + [limit, offset]
        )
    except Exception as e:
        return {"papers": [], "total": 0, "page": page, "has_more": False, "type": type}

    papers = [_parse(dict(r)) for r in rows]
    return {
        "papers": papers,
        "total": total,
        "page": page,
        "has_more": (offset + len(papers)) < total,
        "type": type,
    }


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


# ── Public Landing API ────────────────────────────────────────────────────────

# All 10 topic definitions (icon, tagline, arXiv hints)
_TOPIC_META = {
    "Language": {
        "emoji": "💬",
        "label": "Language & AI",
        "tagline": "How machines are learning to talk, read, reason — and change how we work",
        "color": "blue",
        # Journalist-style hook shown on the landing page — no paper details, just narrative
        "hook": "Right now, thousands of engineers are in a race to build an AI that reads, writes, and reasons better than any human — and this week's papers show they are dangerously close.",
    },
    "Vision": {
        "emoji": "👁️",
        "label": "Vision & Creativity",
        "tagline": "Teaching computers to see, understand images, and create stunning visuals",
        "color": "pink",
        "hook": "Somewhere in a research lab tonight, an AI is learning to see the world the way a child does — and what it is finding is quietly changing everything, from medicine to art to how we remember the past.",
    },
    "Robots": {
        "emoji": "🤖",
        "label": "Robots & Automation",
        "tagline": "The machines that move, build, and act in the physical world",
        "color": "orange",
        "hook": "The robot revolution everyone predicted in science fiction is finally happening — it just looks nothing like what anyone imagined, and the latest research shows it is arriving faster than most people are ready for.",
    },
    "Health": {
        "emoji": "🧬",
        "label": "Medicine & Health",
        "tagline": "AI finding cures, predicting illness, and accelerating drug discovery",
        "color": "green",
        "hook": "The same AI powering your phone is being quietly trained on millions of patient records — and it just found drug combinations that doctors missed for decades. The question now is whether we are ready to trust it with our lives.",
    },
    "Safety": {
        "emoji": "🛡️",
        "label": "AI Safety & Trust",
        "tagline": "Making AI systems that humans can actually trust and control",
        "color": "red",
        "hook": "The people building the most powerful AI systems in human history are also the ones most publicly worried about what happens if they succeed — and their latest research explains exactly what keeps them up at night.",
    },
    "Science": {
        "emoji": "🔬",
        "label": "Science & Discovery",
        "tagline": "AI accelerating breakthroughs across physics, chemistry, and beyond",
        "color": "cyan",
        "hook": "AI does not get tired, does not have hunches, and does not give up — which is exactly why it is now solving scientific problems that stumped the world's best researchers for decades.",
    },
    "Efficiency": {
        "emoji": "⚡",
        "label": "Speed & Efficiency",
        "tagline": "Making AI smaller, faster, and cheaper — so it runs anywhere",
        "color": "yellow",
        "hook": "The biggest secret in AI right now is not about making models smarter — it is about making them small enough to run in your pocket, on a cheap chip, without the internet. That race is almost won.",
    },
    "Business": {
        "emoji": "💼",
        "label": "Business & Economy",
        "tagline": "AI reshaping how companies operate, compete, and serve customers",
        "color": "purple",
        "hook": "Every company on earth is quietly asking the same question right now: what happens to our business when AI can do everything our best employees do — and the answer coming from this week's research is not reassuring.",
    },
    "Climate": {
        "emoji": "🌍",
        "label": "Climate & Energy",
        "tagline": "Using AI to understand and fight climate change before time runs out",
        "color": "emerald",
        "hook": "Hidden inside thousands of climate research papers lies a simple question that has stumped scientists for fifty years — and AI is now giving us the clearest answer we have ever had about what is coming and what we can still do.",
    },
    "General": {
        "emoji": "🧠",
        "label": "Big Ideas",
        "tagline": "Research that doesn't fit a single box — but still matters enormously",
        "color": "slate",
        "hook": "Some of the most important discoveries in AI do not fit a neat category — they just quietly appear in the research, get ignored for months, and then suddenly change everything. These are this week's ones to watch.",
    },
}

_LANDING_SELECT = (
    "rowid as id, arxiv_id, title, abstract, authors, categories, primary_category, "
    "published_at, pdf_url, github_url, github_stars, citation_count, h_index_max, "
    "COALESCE(influential_citation_count, 0) as influential_citation_count, "
    "normalized_score, current_score, trend_label, ai_topic_tags, ai_summary, hook_text, "
    "hf_upvotes, hn_points, hn_comments, citation_velocity, trending_score, "
    "view_count, save_count, ai_topic_category, ai_lay_summary, ai_why_important, "
    "ai_key_findings, ai_journalist_hook"
)

# arXiv prefix → topic (mirrors ai_service.py heuristic, no AI call needed)
_ARXIV_TO_TOPIC = {
    "cs.cl": "Language", "cs.ai": "Language", "cs.ne": "Language",
    "cs.cv": "Vision",
    "cs.ro": "Robots", "cs.sy": "Robots",
    "q-bio": "Health", "eess.sp": "Health",
    "cs.cr": "Safety",
    "physics": "Science", "astro-ph": "Science", "math": "Science",
    "cond-mat": "Science", "quant-ph": "Science",
    "cs.ar": "Efficiency", "cs.pf": "Efficiency",
    "econ": "Business", "cs.ir": "Business",
    "cs.lg": "Language",  # most cs.LG is language/ML
    "stat.ml": "Language",
}

_ABSTRACT_TOPIC_HINTS = [
    (["climate", "carbon", "emission", "sustainability", "renewable"], "Climate"),
    (["drug", "clinical", "patient", "genomic", "protein", "disease", "medical", "biomedical"], "Health"),
    (["robot", "manipulation", "locomotion", "autonomous vehicle", "drone", "actuator"], "Robots"),
    (["safety", "alignment", "hallucination", "bias", "fairness", "ethics", "toxic"], "Safety"),
    (["quantization", "pruning", "distillation", "compression", "inference speed", "edge deploy", "latency"], "Efficiency"),
    (["finance", "stock", "market", "forecast", "recommendation", "e-commerce", "trading"], "Business"),
    (["image", "vision", "visual", "diffusion", "generation", "segmentation", "detection", "video"], "Vision"),
]

def _derive_topic(primary_category: str, categories_json: str, abstract: str = "") -> str:
    """
    Derive a human topic from arXiv metadata — no AI call needed.
    Priority: pre-saved ai_topic_category → arXiv prefix map → abstract keywords → General
    """
    cats = []
    if primary_category:
        cats.append(primary_category.lower())
    if categories_json:
        try:
            extra = json.loads(categories_json)
            cats += [c.lower() for c in extra if isinstance(c, str)]
        except Exception:
            pass

    for cat in cats:
        for prefix, topic in _ARXIV_TO_TOPIC.items():
            if cat.startswith(prefix):
                return topic

    # Abstract keyword scan
    text = (abstract or "").lower()
    for keywords, topic in _ABSTRACT_TOPIC_HINTS:
        if any(kw in text for kw in keywords):
            return topic

    return "General"


def _parse_landing(p: dict) -> dict:
    """Parse a landing paper row — includes new AI fields."""
    for f in ("authors", "categories", "ai_topic_tags"):
        v = p.get(f)
        if isinstance(v, str):
            try:
                p[f] = json.loads(v)
            except Exception:
                p[f] = []
        elif v is None:
            p[f] = []
    # Parse key findings JSON array
    kf = p.get("ai_key_findings")
    if isinstance(kf, str):
        try:
            p["ai_key_findings"] = json.loads(kf)
        except Exception:
            p["ai_key_findings"] = []
    elif not isinstance(kf, list):
        p["ai_key_findings"] = []
    return p


@router.get("/landing")
async def get_landing(db: TursoClient = Depends(get_db)):
    """
    Public landing page data — news magazine style, for non-technical readers.
    Works with ALL papers regardless of whether AI landing fields are generated.
    Topic grouping is derived on-the-fly from arXiv categories when ai_topic_category is null.
    Returns:
      - hero: highest community-signal paper (HF/HN) or best-scored fallback
      - breaking: top 5 papers with strongest community signal
      - categories: all papers grouped into human topics, 5 hooks per category
    """
    current_week = await _current_week(db)
    cache_key = f"landing_v3:w{current_week}:{date.today().isoformat()}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    # ── Fetch current week's papers ───────────────────────────────────────────
    pool_rows = await db.fetchall(
        f"SELECT {_LANDING_SELECT} FROM papers "
        "WHERE is_deleted=0 AND is_duplicate=0 "
        "AND COALESCE(display_week, 1) <= ? "
        "ORDER BY "
        "  (COALESCE(hf_upvotes,0)*0.35 + COALESCE(hn_points,0)*0.25 + "
        "   COALESCE(citation_count,0)*0.02 + COALESCE(github_stars,0)*0.005 + "
        "   COALESCE(normalized_score,0)*30) DESC "
        "LIMIT 500",
        [current_week]
    )

    from collections import defaultdict
    topic_buckets: dict = defaultdict(list)  # topic → [paper, …]  max 5 each
    all_parsed = []

    for r in pool_rows:
        p = _parse_landing(dict(r))
        # Use saved category if available, else derive on-the-fly
        topic = (
            p.get("ai_topic_category")
            or _derive_topic(
                p.get("primary_category", ""),
                json.dumps(p.get("categories", [])),
                p.get("abstract") or p.get("ai_summary") or "",
            )
        )
        p["_derived_topic"] = topic
        all_parsed.append(p)
        if len(topic_buckets[topic]) < 5:
            topic_buckets[topic].append(p)

    # ── Hero: best HF/HN paper first, else best score ─────────────────────────
    social_papers = [p for p in all_parsed if (p.get("hf_upvotes") or 0) + (p.get("hn_points") or 0) > 0]
    hero = social_papers[0] if social_papers else (all_parsed[0] if all_parsed else None)
    hero_id = hero["id"] if hero else None

    # ── Breaking: top 5 community-signal papers (exclude hero) ────────────────
    breaking = [
        p for p in social_papers
        if p["id"] != hero_id
    ][:5]
    # If not enough social papers, pad with high-score papers
    if len(breaking) < 3:
        extras = [p for p in all_parsed if p["id"] != hero_id and p not in breaking]
        breaking = (breaking + extras)[:5]

    # ── Categories: remove hero from buckets, enforce max 5 per topic ─────────
    categories = []
    for topic, meta in _TOPIC_META.items():
        bucket = [p for p in topic_buckets.get(topic, []) if p["id"] != hero_id]
        if not bucket:
            continue
        # Count all papers in this topic across full pool (not just top 5)
        total_in_topic = sum(1 for p in all_parsed if p.get("_derived_topic") == topic and p["id"] != hero_id)
        categories.append({
            "topic": topic,
            **meta,
            "paper_count": total_in_topic,
            "papers": bucket[:5],
        })

    result = {
        "hero": hero,
        "breaking": breaking,
        "categories": categories,
        "topic_meta": _TOPIC_META,
    }
    await cache_set(cache_key, result, ttl=1800)
    return result


@router.get("/landing/topic/{topic}")
async def get_topic_papers(
    topic: str,
    page: int = Query(0, ge=0),
    db: TursoClient = Depends(get_db),
):
    """
    All papers for a given human topic — paginated.
    Uses current week's papers only (display_week <= current_week).
    Top-10 pinned by combined credibility score; remainder rotates daily.
    """
    if topic not in _TOPIC_META:
        return {"papers": [], "total": 0, "topic": topic, "meta": None}

    current_week = await _current_week(db)

    # Fetch current week's papers — no text filter, we generate hooks from title if needed
    pool_rows = await db.fetchall(
        f"SELECT {_LANDING_SELECT} FROM papers "
        "WHERE is_deleted=0 AND is_duplicate=0 "
        "AND COALESCE(display_week, 1) <= ? "
        "ORDER BY "
        "  (COALESCE(hf_upvotes,0)*0.35 + COALESCE(hn_points,0)*0.25 + "
        "   COALESCE(citation_count,0)*0.02 + COALESCE(github_stars,0)*0.005 + "
        "   COALESCE(normalized_score,0)*30) DESC "
        "LIMIT 2000",
        [current_week]
    )

    # Filter to matching topic, keeping credibility-sorted order
    matched = []
    for r in pool_rows:
        p = _parse_landing(dict(r))
        t = (
            p.get("ai_topic_category")
            or _derive_topic(
                p.get("primary_category", ""),
                json.dumps(p.get("categories", [])),
                p.get("abstract") or p.get("ai_summary") or "",
            )
        )
        if t == topic:
            matched.append(p)

    # ── Page layout: top 6 pinned on page 0, then 10 per page ───────────────
    # Top 6 by score are always shown first and marked is_pinned=True.
    # Remaining papers are shuffled daily (deterministic per date+topic seed).
    PINNED_COUNT = 6
    LOAD_MORE_SIZE = 10

    pinned = [dict(p, is_pinned=True) for p in matched[:PINNED_COUNT]]
    pool = matched[PINNED_COUNT:]

    # Deterministic daily shuffle of the remaining papers
    seed_str = f"{date.today().isoformat()}:{topic}"
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (2 ** 31)
    rng = random.Random(seed)
    rotating = pool.copy()
    rng.shuffle(rotating)
    rotating = [dict(p, is_pinned=False) for p in rotating]

    if page == 0:
        page_papers = pinned  # only top 6 on first load
        has_more = len(rotating) > 0
    else:
        rot_offset = (page - 1) * LOAD_MORE_SIZE
        page_papers = rotating[rot_offset: rot_offset + LOAD_MORE_SIZE]
        has_more = (rot_offset + LOAD_MORE_SIZE) < len(rotating)

    # Hooks are pre-generated by the admin "Fill Missing Rich Hooks" task.
    # Topic page just reads ai_journalist_hook from DB — no AI calls at request time.

    # ── Weekly digest — generated once per topic per week, cached in system_config ──
    # V2 cache key: new editorial format with paper titles in bold
    weekly_digest = ""
    if page == 0:
        digest_key = f"TOPIC_DIGEST_V3_{topic}_{current_week}"
        from app.core.database import get_system_config, set_system_config
        weekly_digest = await get_system_config(digest_key) or ""
        if not weekly_digest and pinned:
            try:
                from app.services.ai_service import AIValidationService
                from app.core.config import settings
                _ai = AIValidationService(settings.OPENROUTER_API_KEY)
                topic_label_str = _TOPIC_META.get(topic, {}).get("label", "AI Research")
                digest_papers = [
                    {
                        "title": p.get("title") or "",
                        "summary": (
                            p.get("ai_lay_summary")
                            or p.get("ai_summary")
                            or p.get("abstract", "")[:300]
                        ),
                    }
                    for p in pinned[:6]
                    if p.get("title") and (p.get("ai_lay_summary") or p.get("ai_summary") or p.get("abstract"))
                ]
                digest = await _ai.generate_topic_weekly_digest(topic_label_str, digest_papers)
                if digest:
                    weekly_digest = digest
                    await set_system_config(digest_key, digest, f"Weekly digest V2 for {topic} week {current_week}")
            except Exception:
                pass

    return {
        "papers": page_papers,
        "total": len(matched),
        "pinned_count": len(pinned),
        "page": page,
        "has_more": has_more,
        "topic": topic,
        "meta": _TOPIC_META.get(topic),
        "weekly_digest": weekly_digest,
    }


@router.get("/report/{paper_id}")
async def get_report(paper_id: int, db: TursoClient = Depends(get_db)):
    """
    Full report page data for a single paper — the digest layer between
    the landing page and the raw arXiv paper.
    Includes: lay summary, key findings, why important, social proof, related papers.
    """
    row = await db.fetchone(
        f"SELECT {_LANDING_SELECT} FROM papers WHERE rowid=? AND is_deleted=0",
        [paper_id]
    )
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Paper not found")

    paper = _parse_landing(dict(row))

    # ── Derive topic early (needed for hook generation below) ─────────────────
    topic_early = (
        paper.get("ai_topic_category")
        or _derive_topic(
            paper.get("primary_category", ""),
            json.dumps(paper.get("categories", [])),
            paper.get("abstract") or paper.get("ai_summary") or "",
        )
    )
    topic_label_early = _TOPIC_META.get(topic_early, {}).get("label", "AI Research")

    # ── Generate rich report-page journalist hook on-the-fly ──────────────────
    # A rich hook is 200-350 words (~1200-2100 chars). Anything <800 chars is
    # a short hook that needs upgrading to the full narrative.
    _report_hook = paper.get("ai_journalist_hook") or ""
    _needs_regen = not _report_hook or len(_report_hook) < 800
    if _needs_regen:
        try:
            from app.services.ai_service import AIValidationService
            from app.core.config import settings
            _ai = AIValidationService(settings.OPENROUTER_API_KEY)
            _report_hook = await _ai.generate_report_hook(
                title=paper.get("title", ""),
                abstract=paper.get("abstract") or paper.get("ai_summary") or "",
                ai_summary=paper.get("ai_summary") or "",
                topic_label=topic_label_early,
                hf_upvotes=int(paper.get("hf_upvotes") or 0),
                hn_points=int(paper.get("hn_points") or 0),
                citation_count=int(paper.get("citation_count") or 0),
                github_stars=int(paper.get("github_stars") or 0),
                h_index=float(paper.get("h_index_max") or 0),
            )
            if _report_hook:
                paper["ai_journalist_hook"] = _report_hook
                # Persist so next request is instant (no AI call needed)
                try:
                    await db.execute(
                        "UPDATE papers SET ai_journalist_hook=? WHERE rowid=?",
                        [_report_hook, paper_id]
                    )
                except Exception:
                    pass
        except Exception:
            pass  # fall back to hook_text / title silently

    # Social proof block — structured for easy display
    hf = int(paper.get("hf_upvotes") or 0)
    hn = int(paper.get("hn_points") or 0)
    hn_c = int(paper.get("hn_comments") or 0)
    cit = int(paper.get("citation_count") or 0)
    stars = int(paper.get("github_stars") or 0)

    h_idx = float(paper.get("h_index_max") or 0)
    influential = int(paper.get("influential_citation_count") or 0)
    cit_vel = float(paper.get("citation_velocity") or 0)
    quality = round((float(paper.get("normalized_score") or 0)) * 100)

    social_proof = {
        "hf_upvotes": hf,
        "hn_points": hn,
        "hn_comments": hn_c,
        "citation_count": cit,
        "influential_citation_count": influential,
        "github_stars": stars,
        "github_url": paper.get("github_url"),
        "h_index": h_idx,
        "citation_velocity": cit_vel,
        "quality_score": quality,
        "has_strong_signal": (hf > 0 or hn > 0 or cit > 10 or stars > 50),
        "community_score": round(
            min(1.0, (hf / 100) * 0.4 + (hn / 200) * 0.35 + min(1.0, cit / 50) * 0.25), 3
        ),
    }

    # Trend explanation — plain English
    trend = paper.get("trend_label", "") or ""
    if "🔥" in trend or "Trending" in trend:
        trend_reason = "This paper is currently one of the most-discussed AI research papers online."
    elif "💎" in trend or "Hidden Gem" in trend:
        trend_reason = "This is a hidden gem — technically strong but not yet widely known. Insiders are paying attention."
    elif "📈" in trend or "Rising" in trend:
        trend_reason = "This paper's popularity is climbing fast. The community is waking up to its importance."
    elif "✨" in trend or "New" in trend:
        trend_reason = "Just published — fresh off the research press and already attracting early interest."
    else:
        trend_reason = "Curated by our scoring system as a high-quality research paper worth reading."

    # Topic was already derived above (reuse)
    topic = topic_early
    paper["_derived_topic"] = topic

    # Related papers — fetch pool, filter by same derived topic
    related_pool = await db.fetchall(
        f"SELECT {_LANDING_SELECT} FROM papers "
        "WHERE is_deleted=0 AND is_duplicate=0 AND rowid != ? "
        "ORDER BY ABS(normalized_score - ?) ASC, normalized_score DESC "
        "LIMIT 80",
        [paper_id, float(paper.get("normalized_score") or 0)]
    )
    related = []
    for r in related_pool:
        rp = _parse_landing(dict(r))
        rt = (
            rp.get("ai_topic_category")
            or _derive_topic(
                rp.get("primary_category", ""),
                json.dumps(rp.get("categories", [])),
                rp.get("abstract") or rp.get("ai_summary") or "",
            )
        )
        if rt == topic:
            related.append(rp)
        if len(related) >= 3:
            break

    return {
        "paper": paper,
        "social_proof": social_proof,
        "trend_reason": trend_reason,
        "related_papers": related,
        "topic_meta": _TOPIC_META.get(topic),
    }
