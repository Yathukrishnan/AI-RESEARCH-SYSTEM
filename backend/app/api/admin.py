import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.core.turso import TursoClient, get_db
from app.core.security import require_admin
from app.core.redis_client import cache_invalidate_pattern
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["admin"])

PROTECTED_KEYS = {"OPENROUTER_API_KEY", "SECRET_KEY", "TURSO_AUTH_TOKEN", "TURSO_DATABASE_URL"}


class ConfigUpdate(BaseModel):
    key: str
    value: str

class KeywordCreate(BaseModel):
    keyword: str
    weight: float = 1.0
    category: str = "general"

class ManualPaperAdd(BaseModel):
    arxiv_id: str


@router.get("/dashboard")
async def dashboard(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    total = await db.count("papers", "is_deleted = 0 AND is_duplicate = 0")
    trending = await db.count("papers", "is_trending = 1 AND is_deleted = 0")
    enriched = await db.count("papers", "is_enriched = 1 AND is_deleted = 0")
    ai_val = await db.count("papers", "is_ai_validated = 1 AND is_deleted = 0")
    above = await db.count("papers", "is_above_threshold = 1 AND is_deleted = 0 AND is_duplicate = 0")
    dupes = await db.count("papers", "is_duplicate = 1")
    scored = await db.count("papers", "current_score > 0 AND is_deleted = 0 AND is_duplicate = 0")

    recent = await db.fetchall(
        "SELECT rowid as id, arxiv_id, title, primary_category, current_score, normalized_score, "
        "is_trending, trend_label, view_count, save_count, "
        "COALESCE(published_at, published_date) as published_at "
        "FROM papers WHERE is_deleted = 0 AND is_duplicate = 0 "
        "ORDER BY COALESCE(created_at, published_date) DESC LIMIT 10"
    )

    # Analysis status
    analysis_row = await db.fetchone("SELECT rowid as id, * FROM analysis_log ORDER BY rowid DESC LIMIT 1")
    analysis_summary_row = await db.fetchone("SELECT value FROM admin_config WHERE key = 'ANALYSIS_SUMMARY'")
    analysis_summary = {}
    if analysis_summary_row and analysis_summary_row.get("value"):
        try:
            analysis_summary = json.loads(analysis_summary_row["value"])
        except Exception:
            pass

    return {
        "stats": {
            "total_papers": total,
            "scored_papers": scored,
            "visible_papers": above,
            "trending_papers": trending,
            "enriched_papers": enriched,
            "ai_validated_papers": ai_val,
            "duplicate_papers": dupes,
        },
        "analysis": analysis_row or {},
        "analysis_summary": analysis_summary,
        "recent_papers": recent,
    }


@router.get("/analysis/status")
async def analysis_status(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    """Get current analysis pipeline status."""
    log = await db.fetchone("SELECT rowid as id, * FROM analysis_log ORDER BY rowid DESC LIMIT 1")
    cfg = await db.fetchone("SELECT value FROM admin_config WHERE key = 'ANALYSIS_SUMMARY'")
    return {
        "latest_run": log or {},
        "summary": json.loads(cfg["value"]) if cfg and cfg.get("value") else {}
    }


@router.post("/analysis/run")
async def run_analysis(
    background_tasks: BackgroundTasks,
    force: bool = False,
    _: dict = Depends(require_admin)
):
    """Manually trigger the full analysis pipeline."""
    from app.tasks.analysis import run_full_analysis
    background_tasks.add_task(run_full_analysis, force)
    return {"status": "started", "force_rescore": force}


@router.get("/papers")
async def list_papers(
    page: int = 0, limit: int = 20, sort_by: str = "normalized_score",
    db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)
):
    allowed = {"current_score", "normalized_score", "view_count", "citation_count"}
    if sort_by not in allowed:
        sort_by = "normalized_score"
    offset = page * limit
    papers = await db.fetchall(
        f"SELECT rowid as id, arxiv_id, title, primary_category, current_score, normalized_score, "
        f"is_trending, trend_label, view_count, save_count, is_enriched, is_ai_validated, "
        f"is_above_threshold, is_duplicate, "
        f"COALESCE(published_at, published_date) as published_at "
        f"FROM papers WHERE is_deleted = 0 ORDER BY {sort_by} DESC LIMIT ? OFFSET ?",
        [limit, offset]
    )
    total = await db.count("papers", "is_deleted = 0")
    return {"papers": papers, "total": total, "page": page, "has_more": total > (offset + limit)}


@router.delete("/papers/{paper_id}")
async def delete_paper(paper_id: int, db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    await db.execute("UPDATE papers SET is_deleted = 1 WHERE rowid = ?", [paper_id])
    await cache_invalidate_pattern("feed:*")
    return {"status": "deleted"}


@router.post("/manual-paper")
async def add_manual_paper(data: ManualPaperAdd, background_tasks: BackgroundTasks, _: dict = Depends(require_admin)):
    from app.tasks.paper_tasks import process_single_paper
    background_tasks.add_task(process_single_paper, data.arxiv_id)
    return {"status": "processing", "arxiv_id": data.arxiv_id}


@router.get("/dataset-summary")
async def dataset_summary(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    """Snapshot of the dataset for the admin Config tab summary card."""
    total = await db.count("papers", "is_deleted = 0 AND is_duplicate = 0")
    scored = await db.count("papers", "current_score > 0 AND is_deleted = 0 AND is_duplicate = 0")
    unscored = await db.count("papers", "(current_score IS NULL OR current_score = 0) AND is_deleted = 0 AND is_duplicate = 0")
    above = await db.count("papers", "is_above_threshold = 1 AND is_deleted = 0 AND is_duplicate = 0")
    trending = await db.count("papers", "is_trending = 1 AND is_deleted = 0")
    enriched = await db.count("papers", "is_enriched = 1 AND is_deleted = 0")
    ai_val = await db.count("papers", "is_ai_validated = 1 AND is_deleted = 0")
    dupes = await db.count("papers", "is_duplicate = 1")
    deleted = await db.count("papers", "is_deleted = 1")
    stale = await db.count("papers", "stale_score_weeks >= 2 AND is_deleted = 0")
    with_citations = await db.count("papers", "citation_count > 0 AND is_deleted = 0")
    with_github = await db.count("papers", "github_stars > 0 AND is_deleted = 0")

    # Trend breakdown
    trend_labels = await db.fetchall(
        "SELECT trend_label, COUNT(*) as cnt FROM papers WHERE is_deleted = 0 AND trend_label IS NOT NULL "
        "GROUP BY trend_label ORDER BY cnt DESC"
    )
    # Top categories
    categories = await db.fetchall(
        "SELECT primary_category, COUNT(*) as cnt FROM papers WHERE is_deleted = 0 AND is_duplicate = 0 "
        "GROUP BY primary_category ORDER BY cnt DESC LIMIT 8"
    )
    return {
        "total": total, "scored": scored, "unscored": unscored,
        "above_threshold": above, "trending": trending,
        "enriched": enriched, "ai_validated": ai_val,
        "duplicates": dupes, "deleted": deleted, "stale_2w": stale,
        "with_citations": with_citations, "with_github": with_github,
        "trend_breakdown": trend_labels,
        "top_categories": categories,
        "score_coverage_pct": round(scored / total * 100, 1) if total else 0,
        "visibility_pct": round(above / total * 100, 1) if total else 0,
        "enrichment_pct": round(enriched / total * 100, 1) if total else 0,
    }


@router.get("/config")
async def get_config(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    rows = await db.fetchall(
        "SELECT key, value, description, updated_at FROM admin_config WHERE is_editable = 1 AND is_protected = 0"
    )
    return rows


@router.post("/config")
async def update_config(update: ConfigUpdate, db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    if update.key in PROTECTED_KEYS:
        raise HTTPException(status_code=403, detail=f"Cannot modify protected key: {update.key}")
    row = await db.fetchone("SELECT key FROM admin_config WHERE key = ? AND is_protected = 0", [update.key])
    if not row:
        raise HTTPException(status_code=404, detail="Config key not found or protected")
    await db.execute(
        "UPDATE admin_config SET value = ?, updated_at = datetime('now') WHERE key = ?",
        [update.value, update.key]
    )
    await cache_invalidate_pattern("feed:*")
    return {"status": "updated"}


@router.get("/keywords")
async def get_keywords(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    return await db.fetchall("SELECT * FROM keywords ORDER BY weight DESC")


@router.post("/keywords")
async def add_keyword(kw: KeywordCreate, db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    try:
        await db.execute(
            "INSERT INTO keywords (keyword, weight, category) VALUES (?, ?, ?)",
            [kw.keyword.lower().strip(), kw.weight, kw.category]
        )
        return {"status": "added"}
    except Exception:
        raise HTTPException(status_code=400, detail="Keyword already exists")


@router.delete("/keywords/{kw_id}")
async def delete_keyword(kw_id: int, db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    await db.execute("DELETE FROM keywords WHERE id = ?", [kw_id])
    return {"status": "deleted"}


@router.post("/trigger-fetch")
async def trigger_fetch(days: int = 1, background_tasks: BackgroundTasks = None, _: dict = Depends(require_admin)):
    from app.tasks.paper_tasks import fetch_and_store_papers
    background_tasks.add_task(fetch_and_store_papers, days)
    return {"status": "started", "days": days}


@router.post("/trigger-rescore")
async def trigger_rescore(background_tasks: BackgroundTasks, _: dict = Depends(require_admin)):
    from app.tasks.paper_tasks import rescore_all_papers
    background_tasks.add_task(rescore_all_papers)
    return {"status": "started"}


@router.post("/trigger-enrich")
async def trigger_enrich(batch: int = 50, background_tasks: BackgroundTasks = None, _: dict = Depends(require_admin)):
    from app.tasks.paper_tasks import enrich_pending_papers
    batch = min(max(batch, 1), 500)
    background_tasks.add_task(enrich_pending_papers, batch)
    return {"status": "started", "batch_size": batch}


@router.post("/reset-failed-enrichment")
async def reset_failed_enrichment(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    """Reset papers marked enriched but got no data (likely due to 429 rate limiting).
    Sets is_enriched=0 so they will be retried on the next hourly enrichment run."""
    result = await db.execute(
        "UPDATE papers SET is_enriched = 0, last_enriched_at = NULL "
        "WHERE is_enriched = 1 AND citation_count = 0 AND github_stars = 0 "
        "AND github_url IS NULL AND is_deleted = 0"
    )
    count = result.get("rows_affected", 0) if result else 0
    return {"status": "ok", "reset_count": count}


@router.get("/scheduler/status")
async def scheduler_status(_: dict = Depends(require_admin)):
    """Return next scheduled run times for all pipeline jobs."""
    from app.tasks.scheduler import get_scheduler_status
    from app.core.database import get_system_config
    from datetime import datetime, timezone

    jobs = get_scheduler_status()
    current_week_str = await get_system_config("CURRENT_WEEK")
    system_start = await get_system_config("SYSTEM_START_DATE")

    computed_week = 1
    if system_start:
        try:
            start = datetime.fromisoformat(system_start.replace("Z", "+00:00"))
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            days = (datetime.now(timezone.utc) - start).days
            computed_week = max(1, days // 7 + 1)
        except Exception:
            pass

    return {
        "jobs": jobs,
        "current_week": computed_week,
        "system_start": system_start,
    }


@router.get("/users")
async def list_users(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    rows = await db.fetchall(
        "SELECT rowid as id, email, username, role, is_active, created_at FROM users ORDER BY rowid DESC"
    )
    return rows


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: int, role: str, db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)
):
    if role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")
    await db.execute("UPDATE users SET role = ? WHERE rowid = ?", [role, user_id])
    return {"status": "updated"}
