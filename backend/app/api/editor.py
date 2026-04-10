"""
Editor Feed API — serves autonomous_articles to the frontend
and exposes a trigger endpoint for the EditorAgent pipeline.
"""
import logging

from fastapi import APIRouter, HTTPException, Query

from app.core.turso import db
from app.services.editor_agent import EditorAgent

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/editor", tags=["editor"])


@router.get("/feed")
async def get_editor_feed(page: int = Query(default=1, ge=1)):
    """Return 20 autonomous articles per page, ordered newest first."""
    offset = (page - 1) * 20
    try:
        rows = await db.fetchall(
            """
            SELECT
                id,
                headline,
                article_body,
                points,
                cluster_count,
                paper_ids,
                key_authors,
                strategic_implications,
                strategic_outlook,
                references_json,
                executive_takeaways,
                twelve_month_outlook,
                sources_json,
                social_validations,
                journalist_pov,
                novelty_score,
                created_at
            FROM autonomous_articles
            ORDER BY created_at DESC
            LIMIT 20 OFFSET ?
            """,
            [offset],
        )
        return {"articles": rows, "page": page}
    except Exception as e:
        logger.error("editor feed fetch error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to load editor feed")


@router.post("/generate")
async def trigger_editor_generation():
    """
    Manually kick off the EditorAgent pipeline (admin convenience endpoint).
    Runs synchronously so the caller can see the result count immediately.
    """
    try:
        agent = EditorAgent()
        saved = await agent.generate_and_save_feed()
        return {"saved": saved, "status": "ok"}
    except Exception as e:
        logger.error("editor generation error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
