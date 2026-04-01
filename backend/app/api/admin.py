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

class SubjectCreate(BaseModel):
    subject_code: str
    description: str = ""

class ManualPaperAdd(BaseModel):
    arxiv_id: str

class TopicCategoryCreate(BaseModel):
    key: str          # e.g. "Quantum"
    emoji: str        # e.g. "⚛️"
    label: str        # e.g. "Quantum Computing"
    tagline: str      # short subtitle shown on card
    hook: str         # journalist narrative hook shown on landing page
    color: str = "slate"  # tailwind colour name


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


@router.post("/hooks/generate")
async def generate_hooks(
    background_tasks: BackgroundTasks,
    batch_size: int = 500,
    force: bool = False,
    _: dict = Depends(require_admin)
):
    """
    Generate hook_text for papers.
    force=true: wipe all existing hooks and regenerate with current prompt style.
    force=false: only fill papers where hook_text is NULL.
    """
    from app.tasks.paper_tasks import generate_missing_hooks
    background_tasks.add_task(generate_missing_hooks, batch_size, force)
    return {"status": "started", "batch_size": batch_size, "force": force}


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
    rows = await db.fetchall(
        "SELECT id, keyword, weight, category, is_active FROM keywords ORDER BY weight DESC, keyword ASC"
    )
    # Deduplicate in Python (handles tables created before UNIQUE constraint existed)
    seen: set = set()
    unique = []
    for row in rows:
        key = (row.get("keyword") or "").lower().strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(row)
    return unique


@router.post("/keywords")
async def add_keyword(kw: KeywordCreate, db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    try:
        await db.execute(
            "INSERT OR IGNORE INTO keywords (keyword, weight, category) VALUES (?, ?, ?)",
            [kw.keyword.lower().strip(), kw.weight, kw.category]
        )
        return {"status": "added"}
    except Exception:
        raise HTTPException(status_code=400, detail="Keyword already exists")


@router.delete("/keywords/{kw_id}")
async def delete_keyword(kw_id: int, db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    await db.execute("DELETE FROM keywords WHERE id = ?", [kw_id])
    return {"status": "deleted"}


@router.get("/subjects")
async def get_subjects(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    return await db.fetchall(
        "SELECT id, subject_code, description, is_active FROM arxiv_subjects ORDER BY subject_code ASC"
    )


@router.post("/subjects")
async def add_subject(s: SubjectCreate, db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    try:
        await db.execute(
            "INSERT OR IGNORE INTO arxiv_subjects (subject_code, description) VALUES (?, ?)",
            [s.subject_code.strip().lower(), s.description.strip()]
        )
        return {"status": "added"}
    except Exception:
        raise HTTPException(status_code=400, detail="Subject already exists")


@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: int, db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    await db.execute("DELETE FROM arxiv_subjects WHERE id = ?", [subject_id])
    return {"status": "deleted"}


@router.patch("/subjects/{subject_id}/toggle")
async def toggle_subject(subject_id: int, db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    await db.execute(
        "UPDATE arxiv_subjects SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?",
        [subject_id]
    )
    return {"status": "toggled"}


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


@router.post("/trigger-landing-content")
async def trigger_landing_content(
    batch: int = 100,
    force: bool = False,
    background_tasks: BackgroundTasks = None,
    _: dict = Depends(require_admin),
):
    """
    Generate public landing page AI content (lay summaries, topic categories,
    key findings, why-important text) for papers that don't have it yet.
    Set force=true to regenerate all papers (backfill).
    """
    from app.tasks.paper_tasks import generate_landing_content
    batch = min(max(batch, 1), 500)
    background_tasks.add_task(generate_landing_content, batch, force)
    return {"status": "started", "batch_size": batch, "force": force}


@router.post("/trigger-rich-hooks")
async def trigger_rich_hooks(
    batch: int = 200,
    force: bool = False,
    background_tasks: BackgroundTasks = None,
    _: dict = Depends(require_admin),
):
    """
    Generate rich Wired/Atlantic-style journalist hooks (4-6 sentences, 150-250 words)
    for all papers missing one. These are shown on the Topic page and Report page.
    force=true regenerates all existing hooks (style refresh / backfill).
    """
    from app.tasks.paper_tasks import generate_rich_journalist_hooks
    batch = min(max(batch, 1), 500)
    background_tasks.add_task(generate_rich_journalist_hooks, batch, force)
    return {"status": "started", "batch_size": batch, "force": force}


@router.get("/rich-hooks-status")
async def get_rich_hooks_status(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    """How many papers have rich journalist hooks vs still needing them."""
    total = await db.count("papers", "is_deleted=0 AND is_duplicate=0")
    with_hooks = await db.count(
        "papers",
        "is_deleted=0 AND is_duplicate=0 AND ai_journalist_hook IS NOT NULL AND LENGTH(ai_journalist_hook) >= 800"
    )
    missing = total - with_hooks
    return {
        "total": total,
        "with_rich_hooks": with_hooks,
        "missing_hooks": missing,
        "percent": round(with_hooks / total * 100) if total > 0 else 0,
    }


@router.get("/topic-categories")
async def get_topic_categories(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    """
    Returns all topic categories (built-in + custom) with paper counts and visibility.
    """
    from app.api.feed import _TOPIC_META
    from app.core.database import get_system_config

    # Load hidden keys and custom entries from system_config
    hidden_raw = await get_system_config("TOPIC_HIDDEN_KEYS") or "[]"
    custom_raw = await get_system_config("TOPIC_CUSTOM_ENTRIES") or "[]"
    try:
        hidden_keys = set(json.loads(hidden_raw))
    except Exception:
        hidden_keys = set()
    try:
        custom_entries = json.loads(custom_raw)
    except Exception:
        custom_entries = []

    # Paper counts per topic
    count_rows = await db.fetchall(
        "SELECT ai_topic_category, COUNT(*) as cnt FROM papers "
        "WHERE is_deleted=0 AND is_duplicate=0 AND ai_topic_category IS NOT NULL "
        "GROUP BY ai_topic_category"
    )
    counts = {r["ai_topic_category"]: r["cnt"] for r in count_rows}

    # Build merged list: built-in first, then custom
    result = []
    for key, meta in _TOPIC_META.items():
        result.append({
            "key": key,
            "emoji": meta["emoji"],
            "label": meta["label"],
            "tagline": meta["tagline"],
            "hook": meta.get("hook", ""),
            "color": meta.get("color", "slate"),
            "paper_count": counts.get(key, 0),
            "is_builtin": True,
            "is_visible": key not in hidden_keys,
        })
    for entry in custom_entries:
        key = entry.get("key", "")
        result.append({
            **entry,
            "paper_count": counts.get(key, 0),
            "is_builtin": False,
            "is_visible": key not in hidden_keys,
        })
    return result


@router.post("/topic-categories")
async def add_topic_category(
    body: TopicCategoryCreate,
    db: TursoClient = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Add a custom non-technical topic category."""
    from app.core.database import get_system_config, set_system_config
    raw = await get_system_config("TOPIC_CUSTOM_ENTRIES") or "[]"
    try:
        entries = json.loads(raw)
    except Exception:
        entries = []
    # Prevent duplicate keys
    if any(e.get("key") == body.key for e in entries):
        raise HTTPException(status_code=400, detail="Topic key already exists")
    entries.append({
        "key": body.key,
        "emoji": body.emoji,
        "label": body.label,
        "tagline": body.tagline,
        "hook": body.hook,
        "color": body.color,
    })
    await set_system_config("TOPIC_CUSTOM_ENTRIES", json.dumps(entries), "Custom topic categories for non-technical feed")
    return {"status": "added", "key": body.key}


@router.delete("/topic-categories/{key}")
async def delete_topic_category(
    key: str,
    db: TursoClient = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """
    Hide a built-in topic or permanently delete a custom one.
    """
    from app.api.feed import _TOPIC_META
    from app.core.database import get_system_config, set_system_config

    if key in _TOPIC_META:
        # Built-in: add to hidden list
        raw = await get_system_config("TOPIC_HIDDEN_KEYS") or "[]"
        try:
            hidden = json.loads(raw)
        except Exception:
            hidden = []
        if key not in hidden:
            hidden.append(key)
        await set_system_config("TOPIC_HIDDEN_KEYS", json.dumps(hidden), "Hidden built-in topic categories")
    else:
        # Custom: remove from custom entries
        raw = await get_system_config("TOPIC_CUSTOM_ENTRIES") or "[]"
        try:
            entries = json.loads(raw)
        except Exception:
            entries = []
        entries = [e for e in entries if e.get("key") != key]
        await set_system_config("TOPIC_CUSTOM_ENTRIES", json.dumps(entries), "Custom topic categories for non-technical feed")

    return {"status": "deleted", "key": key}


@router.patch("/topic-categories/{key}/restore")
async def restore_topic_category(
    key: str,
    _: dict = Depends(require_admin),
):
    """Restore a hidden built-in topic category."""
    from app.core.database import get_system_config, set_system_config
    raw = await get_system_config("TOPIC_HIDDEN_KEYS") or "[]"
    try:
        hidden = json.loads(raw)
    except Exception:
        hidden = []
    hidden = [k for k in hidden if k != key]
    await set_system_config("TOPIC_HIDDEN_KEYS", json.dumps(hidden), "Hidden built-in topic categories")
    return {"status": "restored", "key": key}


@router.get("/daily-fetch")
async def daily_fetch_status(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    """Return today's fetch log and the list of papers fetched today."""
    log = await db.fetchone(
        "SELECT rowid as id, * FROM analysis_log WHERE run_type = 'daily_fetch' ORDER BY rowid DESC LIMIT 1"
    )
    papers = await db.fetchall(
        "SELECT rowid as id, arxiv_id, title, primary_category, current_score, normalized_score, "
        "is_trending, trend_label, is_enriched, citation_count, github_stars, "
        "COALESCE(published_at, published_date) as published_at "
        "FROM papers WHERE date(created_at) = date('now') AND is_deleted = 0 AND is_duplicate = 0 "
        "ORDER BY COALESCE(normalized_score, current_score, 0) DESC LIMIT 100"
    )
    today_total = await db.count("papers", "date(created_at) = date('now') AND is_deleted = 0 AND is_duplicate = 0")
    today_scored = await db.count("papers", "date(created_at) = date('now') AND current_score > 0 AND is_deleted = 0 AND is_duplicate = 0")
    today_enriched = await db.count("papers", "date(created_at) = date('now') AND is_enriched = 1 AND is_deleted = 0 AND is_duplicate = 0")
    return {
        "log": log or {},
        "today": {"total": today_total, "scored": today_scored, "enriched": today_enriched},
        "papers": papers,
    }


@router.get("/enrichment-status")
async def enrichment_status(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    """Detailed enrichment progress: citation and GitHub data coverage."""
    total = await db.count("papers", "is_deleted = 0 AND is_duplicate = 0")
    enriched = await db.count("papers", "is_enriched = 1 AND is_deleted = 0")
    # Old papers (>7 days) pending full enrichment — citations will affect their score
    pending_old = await db.count(
        "papers",
        "is_enriched = 0 AND is_deleted = 0 AND "
        "date(COALESCE(published_at, published_date, '2020-01-01')) <= date('now', '-7 days')"
    )
    # New papers (≤7 days) — citations don't affect score yet; deferred until they age
    pending_new = await db.count(
        "papers",
        "is_enriched = 0 AND is_deleted = 0 AND "
        "date(COALESCE(published_at, published_date, date('now'))) > date('now', '-7 days')"
    )
    with_citations = await db.count("papers", "citation_count > 0 AND is_deleted = 0")
    with_github = await db.count("papers", "github_stars > 0 AND is_deleted = 0")
    failed = await db.count(
        "papers",
        "is_enriched = 1 AND citation_count = 0 AND github_stars = 0 AND github_url IS NULL AND is_deleted = 0"
    )
    top_citations = await db.fetchall(
        "SELECT rowid as id, arxiv_id, title, primary_category, citation_count, h_index_max, "
        "normalized_score FROM papers WHERE citation_count > 0 AND is_deleted = 0 "
        "ORDER BY citation_count DESC LIMIT 5"
    )
    top_github = await db.fetchall(
        "SELECT rowid as id, arxiv_id, title, primary_category, github_stars, github_url, "
        "normalized_score FROM papers WHERE github_stars > 0 AND is_deleted = 0 "
        "ORDER BY github_stars DESC LIMIT 5"
    )
    return {
        "total": total, "enriched": enriched,
        "pending_old": pending_old,   # needs SS citation lookup now
        "pending_new": pending_new,   # deferred — citations not used in scoring yet
        "with_citations": with_citations, "with_github": with_github,
        "failed_rate_limit": failed,
        "enrichment_pct": round(enriched / total * 100, 1) if total else 0,
        "citations_pct": round(with_citations / total * 100, 1) if total else 0,
        "github_pct": round(with_github / total * 100, 1) if total else 0,
        "top_by_citations": top_citations,
        "top_by_github": top_github,
    }


@router.get("/social-signals")
async def social_signals_status(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    """Coverage stats for HuggingFace, HackerNews, and OpenAlex social signals."""
    total_visible = await db.count("papers", "is_above_threshold = 1 AND is_deleted = 0 AND is_duplicate = 0")
    with_hf       = await db.count("papers", "hf_upvotes > 0 AND is_deleted = 0")
    with_hn       = await db.count("papers", "hn_points > 0 AND is_deleted = 0")
    with_vel      = await db.count("papers", "citation_velocity > 0 AND is_deleted = 0")
    with_any      = await db.count("papers", "(hf_upvotes > 0 OR hn_points > 0 OR citation_velocity > 0) AND is_deleted = 0")
    checked       = await db.count("papers", "social_checked_at IS NOT NULL AND is_deleted = 0")
    unchecked     = await db.count(
        "papers",
        "is_above_threshold = 1 AND is_deleted = 0 AND is_duplicate = 0 AND social_checked_at IS NULL"
    )
    last_row = await db.fetchone(
        "SELECT social_checked_at FROM papers WHERE social_checked_at IS NOT NULL "
        "ORDER BY social_checked_at DESC LIMIT 1"
    )
    top_hf = await db.fetchall(
        "SELECT rowid as id, arxiv_id, title, hf_upvotes, hn_points, trending_score "
        "FROM papers WHERE hf_upvotes > 0 AND is_deleted = 0 ORDER BY hf_upvotes DESC LIMIT 5"
    )
    top_hn = await db.fetchall(
        "SELECT rowid as id, arxiv_id, title, hn_points, hn_comments, trending_score "
        "FROM papers WHERE hn_points > 0 AND is_deleted = 0 ORDER BY hn_points DESC LIMIT 5"
    )
    total = await db.count("papers", "is_deleted = 0 AND is_duplicate = 0")
    return {
        "total_visible": total_visible,
        "checked": checked,
        "unchecked": unchecked,
        "with_hf_data": with_hf,
        "with_hn_data": with_hn,
        "with_velocity": with_vel,
        "with_any_signal": with_any,
        "last_refresh": last_row["social_checked_at"] if last_row else None,
        "hf_pct": round(with_hf / total * 100, 1) if total else 0,
        "hn_pct": round(with_hn / total * 100, 1) if total else 0,
        "vel_pct": round(with_vel / total * 100, 1) if total else 0,
        "top_hf": top_hf,
        "top_hn": top_hn,
    }


@router.post("/trigger-social-signals")
async def trigger_social_signals(
    batch: int = 200,
    background_tasks: BackgroundTasks = None,
    _: dict = Depends(require_admin),
):
    """Manually trigger a social signal refresh (HF, HN, OpenAlex)."""
    from app.tasks.paper_tasks import refresh_social_signals
    batch = min(max(batch, 1), 500)
    background_tasks.add_task(refresh_social_signals, batch)
    return {"status": "started", "batch_size": batch}


@router.get("/api-health")
async def api_health(db: TursoClient = Depends(get_db), _: dict = Depends(require_admin)):
    """
    Server-side connectivity check for ALL external services.
    Tests a lightweight known-good URL for each API.
    Also checks Turso (DB query) and Redis (ping).
    Returns {service_name: {ok, status, latency_ms}}.
    """
    import httpx, time

    http_checks = {
        "ArXiv":              "http://export.arxiv.org/api/query?search_query=ti:transformer&max_results=1",
        "Semantic Scholar":   "https://api.semanticscholar.org/graph/v1/paper/649def34f8be52c8b66281af98ae884c09aef38b?fields=title",
        "Papers with Code":   "https://paperswithcode.com/api/v1/papers/?limit=1",
        "GitHub API":         "https://api.github.com/repos/huggingface/transformers",
        "HuggingFace Papers": "https://huggingface.co/api/papers/2303.08774",
        "HackerNews Algolia": "https://hn.algolia.com/api/v1/search?query=arxiv&tags=story&hitsPerPage=1",
        "OpenAlex":           "https://api.openalex.org/works/arxiv:2303.08774?select=id",
        "OpenRouter":         "https://openrouter.ai/api/v1/models",
    }
    results = {}
    headers = {"User-Agent": "AI-Research-Intelligence/1.0"}

    async with httpx.AsyncClient(headers=headers, timeout=8) as client:
        for name, url in http_checks.items():
            t0 = time.monotonic()
            try:
                resp = await client.get(url)
                ms = int((time.monotonic() - t0) * 1000)
                results[name] = {"ok": resp.status_code < 400, "status": resp.status_code, "latency_ms": ms}
            except Exception as e:
                ms = int((time.monotonic() - t0) * 1000)
                results[name] = {"ok": False, "status": 0, "latency_ms": ms, "error": str(e)[:80]}

    # Turso (live DB query)
    t0 = time.monotonic()
    try:
        count = await db.count("papers")
        ms = int((time.monotonic() - t0) * 1000)
        results["Turso"] = {"ok": True, "status": 200, "latency_ms": ms, "detail": f"{count} papers in DB"}
    except Exception as e:
        ms = int((time.monotonic() - t0) * 1000)
        results["Turso"] = {"ok": False, "status": 0, "latency_ms": ms, "error": str(e)[:80]}

    # Redis (ping)
    t0 = time.monotonic()
    try:
        from app.core.redis_client import get_redis
        r = await get_redis()
        if r:
            await r.ping()
            ms = int((time.monotonic() - t0) * 1000)
            results["Redis"] = {"ok": True, "status": 200, "latency_ms": ms, "detail": "ping OK"}
        else:
            results["Redis"] = {"ok": False, "status": 0, "latency_ms": 0, "detail": "not configured / unavailable"}
    except Exception as e:
        ms = int((time.monotonic() - t0) * 1000)
        results["Redis"] = {"ok": False, "status": 0, "latency_ms": ms, "error": str(e)[:80]}

    return results


@router.get("/service-config")
async def service_config(_: dict = Depends(require_admin)):
    """
    Returns configuration status for all external services.
    Masks sensitive credentials — only shows set/not-set and a safe preview.
    """
    from app.core.config import settings

    def _mask(val: str, show: int = 6) -> str:
        if not val or val in ("", "dev-secret-key-change-in-production"):
            return None
        return val[:show] + "…" + val[-4:] if len(val) > show + 4 else "•" * len(val)

    def _set(val: str) -> bool:
        return bool(val and val not in ("", "dev-secret-key-change-in-production",
                                        "libsql://placeholder.turso.io", "redis://localhost:6379"))

    configs = [
        {
            "key": "TURSO_DATABASE_URL",
            "label": "Turso Database URL",
            "service": "Turso",
            "set": _set(settings.TURSO_DATABASE_URL),
            "preview": _mask(settings.TURSO_DATABASE_URL, 20) if _set(settings.TURSO_DATABASE_URL) else None,
            "required": True,
            "description": "libsql:// connection string for the Turso edge database",
        },
        {
            "key": "TURSO_AUTH_TOKEN",
            "label": "Turso Auth Token",
            "service": "Turso",
            "set": _set(settings.TURSO_AUTH_TOKEN),
            "preview": _mask(settings.TURSO_AUTH_TOKEN) if _set(settings.TURSO_AUTH_TOKEN) else None,
            "required": True,
            "description": "JWT bearer token for Turso database authentication",
        },
        {
            "key": "SECRET_KEY",
            "label": "JWT Secret Key",
            "service": "Auth",
            "set": _set(settings.SECRET_KEY),
            "preview": None,
            "required": True,
            "description": "Used to sign admin/user JWT tokens. Change in production!",
        },
        {
            "key": "ADMIN_EMAIL",
            "label": "Admin Email",
            "service": "Auth",
            "set": bool(settings.ADMIN_EMAIL),
            "preview": settings.ADMIN_EMAIL,
            "required": True,
            "description": "Email address for the default admin account",
        },
        {
            "key": "REDIS_URL",
            "label": "Redis URL",
            "service": "Redis",
            "set": _set(settings.REDIS_URL),
            "preview": settings.REDIS_URL if _set(settings.REDIS_URL) else None,
            "required": False,
            "description": "redis:// connection string. Optional — caching disabled if missing",
        },
        {
            "key": "FRONTEND_URL",
            "label": "Frontend URL (CORS)",
            "service": "CORS",
            "set": bool(settings.FRONTEND_URL),
            "preview": settings.FRONTEND_URL or None,
            "required": False,
            "description": "Comma-separated allowed frontend origins for CORS",
        },
    ]
    return configs


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
