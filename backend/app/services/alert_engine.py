import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict
from app.core.turso import TursoClient
from app.core.config import settings

logger = logging.getLogger(__name__)

async def generate_alerts(db: TursoClient) -> List[Dict]:
    alerts = []

    trending_count_row = await db.fetchone("SELECT COUNT(*) as cnt FROM papers WHERE is_trending = 1 AND is_deleted = 0")
    trending_count = int(trending_count_row["cnt"]) if trending_count_row else 0

    if trending_count > 0:
        top = await db.fetchone("SELECT rowid as id, ai_topic_tags FROM papers WHERE is_trending = 1 AND is_deleted = 0 ORDER BY scr_value DESC")
        tags = "AI/ML"
        if top and top.get("ai_topic_tags"):
            import json
            try:
                tag_list = json.loads(top["ai_topic_tags"])
                if tag_list: tags = tag_list[0]
            except: pass
        alerts.append({
            "type": "trending", "emoji": "🚀",
            "title": f"{trending_count} papers trending in {tags} today",
            "message": f"🚀 {trending_count} papers are trending in {tags}",
            "paper_id": top["id"] if top else None
        })

    growth = await db.fetchone(
        "SELECT rowid as id, title, current_score, previous_score FROM papers WHERE previous_score > 0 AND current_score > previous_score AND is_deleted = 0 ORDER BY (current_score - previous_score) DESC"
    )
    if growth:
        prev = float(growth.get("previous_score") or 0.001)
        curr = float(growth.get("current_score") or 0)
        pct = int((curr - prev) / prev * 100)
        if pct > 20:
            title_text = str(growth.get("title", ""))[:60]
            alerts.append({
                "type": "high_growth", "emoji": "📈",
                "title": f"Paper grew +{pct}% this week",
                "message": f"📈 '{title_text}...' grew +{pct}% this week",
                "paper_id": growth["id"]
            })

    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    new_count_row = await db.fetchone("SELECT COUNT(*) as cnt FROM papers WHERE created_at > ? AND is_deleted = 0", [since])
    new_count = int(new_count_row["cnt"]) if new_count_row else 0
    if new_count > 3:
        top_new = await db.fetchone(
            "SELECT rowid as id FROM papers WHERE created_at > ? AND is_deleted = 0 "
            "ORDER BY COALESCE(normalized_score, keyword_score, 0) DESC LIMIT 1", [since]
        )
        alerts.append({
            "type": "new_papers", "emoji": "✨",
            "title": f"{new_count} new AI papers added today",
            "message": f"✨ {new_count} new research papers added in the last 24h — tap to see the top pick",
            "paper_id": top_new["id"] if top_new else None
        })

    top_gem = await db.fetchone(
        "SELECT rowid as id FROM papers WHERE normalized_score > 0.6 AND view_count < 20 AND is_deleted = 0 "
        "ORDER BY normalized_score DESC LIMIT 1"
    )
    gems_row = await db.fetchone("SELECT COUNT(*) as cnt FROM papers WHERE normalized_score > 0.6 AND view_count < 20 AND is_deleted = 0")
    gems = int(gems_row["cnt"]) if gems_row else 0
    if gems > 0:
        alerts.append({
            "type": "hidden_gems", "emoji": "💎",
            "title": f"{gems} hidden gems waiting to be discovered",
            "message": f"💎 {gems} high-quality papers with low views — tap to explore the best one",
            "paper_id": top_gem["id"] if top_gem else None
        })

    return alerts[:5]
