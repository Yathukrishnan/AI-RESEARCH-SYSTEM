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


_TRENDING_HOOKS = [
    "This week's highest-ranked papers are in",
    "The AI community is moving fast — see what's hot",
    "Top-scoring papers researchers are reading right now",
    "What the field is buzzing about this week",
    "High-signal papers climbing the rankings",
]

_GEM_HOOKS = [
    "High-impact papers flying under the radar",
    "Brilliant work that hasn't gone viral — yet",
    "Overlooked papers with exceptional scores",
    "Before everyone else finds these",
    "Strong signal, low noise — undiscovered gems",
]

_NEW_HOOKS = [
    "Fresh papers just landed in the feed",
    "New research added since yesterday",
    "Latest arXiv submissions, scored and ranked",
    "Just in — new papers across AI & ML",
    "Newest additions to the intelligence feed",
]

_RISING_HOOKS = [
    "Papers gaining momentum fast",
    "Rising stars in this week's rankings",
    "Scores climbing — papers to watch",
    "These papers are accelerating in the rankings",
    "Early movers gaining traction across the field",
]


async def generate_alerts(db: TursoClient) -> List[Dict]:
    alerts = []

    # ── Trending papers ───────────────────────────────────────────────────
    try:
        trending_count = await db.count("papers", "is_trending = 1 AND is_deleted = 0")
        if trending_count:
            alerts.append({
                "type": "trending",
                "emoji": "🔥",
                "title": random.choice(_TRENDING_HOOKS),
                "message": f"{trending_count} trending papers · tap to explore",
                "navigate_to": "trending",
            })
    except Exception:
        pass

    # ── New papers (last 7 days) ───────────────────────────────────────
    try:
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        new_count = await db.count(
            "papers", "created_at > ? AND is_deleted = 0", [since]
        )
        if new_count:
            alerts.append({
                "type": "new_papers",
                "emoji": "✨",
                "title": random.choice(_NEW_HOOKS),
                "message": f"{new_count} papers added · tap to explore",
                "navigate_to": "new",
            })
    except Exception:
        pass

    # ── Hidden gems ───────────────────────────────────────────────────
    try:
        gems_count = await db.count(
            "papers",
            "normalized_score > 0.3 AND view_count < 30 AND is_deleted = 0 AND is_above_threshold = 1",
        )
        if gems_count:
            alerts.append({
                "type": "hidden_gems",
                "emoji": "💎",
                "title": random.choice(_GEM_HOOKS),
                "message": f"{gems_count} hidden gems · tap to explore",
                "navigate_to": "gems",
            })
    except Exception:
        pass

    # ── Rising papers ─────────────────────────────────────────────────
    try:
        rising_count = await db.count(
            "papers",
            "is_above_threshold = 1 AND is_deleted = 0 "
            "AND date(COALESCE(last_scored_at, created_at)) >= date('now', '-3 days')",
        )
        if rising_count:
            alerts.append({
                "type": "high_growth",
                "emoji": "📈",
                "title": random.choice(_RISING_HOOKS),
                "message": f"{rising_count} papers rising · tap to explore",
                "navigate_to": "rising",
            })
    except Exception:
        pass

    random.shuffle(alerts)
    return alerts[:4]
