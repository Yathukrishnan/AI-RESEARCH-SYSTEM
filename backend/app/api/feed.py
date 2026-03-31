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
