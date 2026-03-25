from fastapi import APIRouter, Depends
from app.core.turso import TursoClient, get_db
from app.services.alert_engine import generate_alerts
from datetime import datetime, timezone

router = APIRouter(tags=["alerts"])

@router.get("/alerts")
async def get_alerts(db: TursoClient = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    rows = await db.fetchall(
        "SELECT * FROM alerts WHERE is_active = 1 AND expires_at > ? ORDER BY created_at DESC LIMIT 5",
        [now]
    )
    if rows:
        return rows
    return await generate_alerts(db)
