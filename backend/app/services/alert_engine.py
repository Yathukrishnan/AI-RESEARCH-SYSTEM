import json
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import List, Dict
from app.core.turso import TursoClient

logger = logging.getLogger(__name__)


def _hook_or_title(paper: Dict, max_len: int = 85) -> str:
    hook = (paper.get("hook_text") or "").strip()
    if hook:
        return hook[:max_len]
    title = (paper.get("title") or "").strip()
    if len(title) <= max_len:
        return title
    return title[:max_len - 1].rsplit(" ", 1)[0] + "…"


async def generate_alerts(db: TursoClient) -> List[Dict]:
    alerts = []

    # ── Trending papers ───────────────────────────────────────────────────
    trending = await db.fetchall(
        "SELECT rowid as id, title, hook_text FROM papers "
        "WHERE is_trending = 1 AND is_deleted = 0 "
        "ORDER BY normalized_score DESC LIMIT 10"
    )
    if trending:
        for p in random.sample(trending, min(2, len(trending))):
            alerts.append({
                "type": "trending",
                "emoji": "🔥",
                "title": _hook_or_title(p),
                "message": "Trending · tap to read",
                "paper_id": p["id"],
            })

    # ── New papers (last 24 h) ─────────────────────────────────────────
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    new_papers = await db.fetchall(
        "SELECT rowid as id, title, hook_text FROM papers "
        "WHERE created_at > ? AND is_deleted = 0 "
        "AND (hook_text IS NOT NULL AND hook_text != '') "
        "ORDER BY COALESCE(normalized_score, keyword_score, 0) DESC LIMIT 10",
        [since]
    )
    if new_papers:
        for p in random.sample(new_papers, min(2, len(new_papers))):
            alerts.append({
                "type": "new_papers",
                "emoji": "✨",
                "title": _hook_or_title(p),
                "message": "Just added · tap to read",
                "paper_id": p["id"],
            })

    # ── Hidden gems ───────────────────────────────────────────────────
    gems = await db.fetchall(
        "SELECT rowid as id, title, hook_text FROM papers "
        "WHERE normalized_score > 0.55 AND view_count < 20 AND is_deleted = 0 "
        "AND (hook_text IS NOT NULL AND hook_text != '') "
        "ORDER BY normalized_score DESC LIMIT 10"
    )
    if gems:
        p = random.choice(gems)
        alerts.append({
            "type": "hidden_gems",
            "emoji": "💎",
            "title": _hook_or_title(p),
            "message": "Hidden gem · barely seen · tap to read",
            "paper_id": p["id"],
        })

    # ── Rising papers (high score, recently scored) ───────────────────
    rising = await db.fetchall(
        "SELECT rowid as id, title, hook_text FROM papers "
        "WHERE is_above_threshold = 1 AND is_deleted = 0 "
        "AND (hook_text IS NOT NULL AND hook_text != '') "
        "AND date(COALESCE(last_scored_at, created_at)) >= date('now', '-3 days') "
        "ORDER BY normalized_score DESC LIMIT 10"
    )
    if rising:
        p = random.choice(rising)
        alerts.append({
            "type": "high_growth",
            "emoji": "📈",
            "title": _hook_or_title(p),
            "message": "Rising fast · tap to read",
            "paper_id": p["id"],
        })

    random.shuffle(alerts)
    return alerts[:5]
