import json
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.turso import TursoClient, get_db

router = APIRouter(tags=["papers"])

def _parse_paper(p: dict) -> dict:
    for field in ("authors", "categories", "ai_topic_tags"):
        val = p.get(field)
        if isinstance(val, str):
            try: p[field] = json.loads(val)
            except: p[field] = []
        elif val is None:
            p[field] = []
    return p

@router.get("/paper/{paper_id}")
async def get_paper_detail(paper_id: int, db: TursoClient = Depends(get_db)):
    paper = await db.fetchone(
        "SELECT rowid as id, * FROM papers WHERE rowid = ? AND is_deleted = 0", [paper_id]
    )
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    paper = _parse_paper(paper)
    paper["score_breakdown"] = {
        "ai_relevance": paper.get("ai_relevance_score", 0),
        "ai_impact": paper.get("ai_impact_score", 0),
        "keyword_score": paper.get("keyword_score", 0),
        "citation_count": paper.get("citation_count", 0),
        "github_stars": paper.get("github_stars", 0),
        "h_index_max": paper.get("h_index_max", 0),
        "score_type": paper.get("score_type", "new"),
        "scr_value": paper.get("scr_value", 0),
    }
    return paper

@router.get("/paper/{paper_id}/score-history")
async def get_score_history(paper_id: int, db: TursoClient = Depends(get_db)):
    rows = await db.fetchall(
        "SELECT score, score_type, scr_value, scored_at FROM score_history WHERE paper_id = ? ORDER BY scored_at ASC LIMIT 50",
        [paper_id]
    )
    return rows

@router.get("/similar/{paper_id}")
async def get_similar(paper_id: int, limit: int = Query(6, le=20), db: TursoClient = Depends(get_db)):
    paper = await db.fetchone(
        "SELECT rowid as id, categories, ai_topic_tags, primary_category FROM papers WHERE rowid = ?",
        [paper_id]
    )
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    primary_cat = paper.get("primary_category") or "cs.AI"
    candidates = await db.fetchall(
        "SELECT rowid as id, * FROM papers WHERE rowid != ? AND is_deleted = 0 "
        "AND (primary_category = ? OR primary_category IS NULL) "
        "ORDER BY current_score DESC LIMIT ?",
        [paper_id, primary_cat, limit * 3]
    )

    if not candidates:
        candidates = await db.fetchall(
            "SELECT rowid as id, * FROM papers WHERE rowid != ? AND is_deleted = 0 ORDER BY current_score DESC LIMIT ?",
            [paper_id, limit]
        )

    return [_parse_paper(p) for p in candidates[:limit]]
