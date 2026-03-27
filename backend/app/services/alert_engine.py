import json
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import List, Dict
from app.core.turso import TursoClient

logger = logging.getLogger(__name__)

def _hook_or_title(paper: Dict, max_len: int = 90) -> str:
    """Return hook_text if present, else trimmed title."""
    hook = (paper.get("hook_text") or "").strip()
    if hook:
        return hook[:max_len]
    title = (paper.get("title") or "").strip()
    if len(title) <= max_len:
        return title
    return title[:max_len - 1].rsplit(" ", 1)[0] + "…"


async def generate_alerts(db: TursoClient) -> List[Dict]:
    alerts = []

    # ── 1. Trending papers ────────────────────────────────────────────────
    trending_papers = await db.fetchall(
        "SELECT rowid as id, title, hook_text FROM papers "
        "WHERE is_trending = 1 AND is_deleted = 0 "
        "ORDER BY normalized_score DESC LIMIT 5"
    )
    if trending_papers:
        # Pick up to 2 random trending papers as individual alerts
        picks = random.sample(trending_papers, min(2, len(trending_papers)))
        for p in picks:
            alerts.append({
                "type": "trending",
                "emoji": "🔥",
                "title": _hook_or_title(p),
                "message": "Trending now · tap to explore",
                "paper_id": p["id"],
                "navigate_to": "trending",
            })

    # ── 2. Fast-rising (high score growth) ───────────────────────────────
    rising_papers = await db.fetchall(
        "SELECT rowid as id, title, hook_text, current_score, previous_score FROM papers "
        "WHERE previous_score > 0 AND current_score > previous_score "
        "AND is_deleted = 0 ORDER BY (current_score - previous_score) DESC LIMIT 5"
    )
    for p in rising_papers[:1]:
        prev = float(p.get("previous_score") or 0.001)
        curr = float(p.get("current_score") or 0)
        pct = int((curr - prev) / prev * 100)
        if pct > 20:
            alerts.append({
                "type": "high_growth",
                "emoji": "📈",
                "title": _hook_or_title(p),
                "message": f"Rising +{pct}% · tap to see what's climbing",
                "paper_id": p["id"],
                "navigate_to": "trending",
            })

    # ── 3. New papers (last 24 h) ─────────────────────────────────────────
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    new_papers = await db.fetchall(
        "SELECT rowid as id, title, hook_text FROM papers "
        "WHERE created_at > ? AND is_deleted = 0 "
        "ORDER BY COALESCE(normalized_score, keyword_score, 0) DESC LIMIT 5",
        [since]
    )
    if len(new_papers) > 3:
        # Pick 1-2 top new papers as hooks
        picks = new_papers[:2]
        for p in picks:
            alerts.append({
                "type": "new_papers",
                "emoji": "✨",
                "title": _hook_or_title(p),
                "message": f"Just added · {len(new_papers)} new papers today",
                "paper_id": p["id"],
                "navigate_to": "new",
            })

    # ── 4. Hidden gems ────────────────────────────────────────────────────
    gems = await db.fetchall(
        "SELECT rowid as id, title, hook_text FROM papers "
        "WHERE normalized_score > 0.6 AND view_count < 20 AND is_deleted = 0 "
        "ORDER BY normalized_score DESC LIMIT 10"
    )
    if gems:
        # Pick 1 random gem so it feels fresh each load
        p = random.choice(gems)
        alerts.append({
            "type": "hidden_gems",
            "emoji": "💎",
            "title": _hook_or_title(p),
            "message": "Hidden gem · high score, barely seen",
            "paper_id": p["id"],
            "navigate_to": "gems",
        })

    # Return up to 5, shuffled so order feels fresh
    random.shuffle(alerts)
    return alerts[:5]
