import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.turso import db as turso_db
from app.core.database import init_db, get_system_config, set_system_config
from app.core.security import hash_password
from app.tasks.scheduler import start_scheduler, stop_scheduler
from app.api import auth, feed, papers, alerts, admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


async def seed_defaults():
    """Seed admin user, config, and keywords on first run (fully idempotent)."""
    # Admin user – INSERT OR IGNORE so it's safe even if row exists with different schema
    try:
        await turso_db.execute(
            "INSERT OR IGNORE INTO users (email, username, hashed_password, role) VALUES (?, ?, ?, 'admin')",
            [settings.ADMIN_EMAIL, "admin", hash_password(settings.ADMIN_PASSWORD)]
        )
        logger.info(f"Admin user seeded (or already exists): {settings.ADMIN_EMAIL}")
    except Exception as e:
        logger.warning(f"Could not seed admin user (skipping): {e}")

    # System start date
    try:
        if not await get_system_config("SYSTEM_START_DATE"):
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat()
            await set_system_config("SYSTEM_START_DATE", now, "System first start date")
            logger.info(f"System start date set: {now}")
    except Exception as e:
        logger.warning(f"Could not set SYSTEM_START_DATE: {e}")

    # Config entries
    configs = [
        ("ARXIV_API_URL", settings.ARXIV_API_URL, "arXiv API endpoint", 1, 0),
        ("SEMANTIC_SCHOLAR_API_URL", settings.SEMANTIC_SCHOLAR_API_URL, "Semantic Scholar API", 1, 0),
        ("PAPERS_WITH_CODE_API_URL", settings.PAPERS_WITH_CODE_API_URL, "Papers with Code API", 1, 0),
        ("PAPERS_PER_DAY", str(settings.PAPERS_PER_DAY), "Papers shown per day", 1, 0),
        ("SCR_THRESHOLD", str(settings.SCR_THRESHOLD), "Trend detection threshold", 1, 0),
        ("SCORE_THRESHOLD", "0.25", "Minimum normalized_score to show in feed (0-1)", 1, 0),
        ("OPENROUTER_API_KEY", "***PROTECTED***", "OpenRouter key (env only, not editable)", 0, 1),
    ]
    for key, value, desc, editable, protected in configs:
        try:
            await turso_db.execute(
                "INSERT OR IGNORE INTO admin_config (key, value, description, is_editable, is_protected) VALUES (?, ?, ?, ?, ?)",
                [key, value if not protected else "***PROTECTED***", desc, editable, protected]
            )
        except Exception as e:
            logger.warning(f"Could not seed config {key}: {e}")

    # Default keywords
    for kw in [
        "transformer", "large language model", "llm", "diffusion model",
        "reinforcement learning", "rlhf", "multimodal", "vision language",
        "neural network", "deep learning", "fine-tuning", "few-shot",
        "zero-shot", "chain of thought", "reasoning", "attention mechanism",
        "bert", "gpt", "self-supervised", "contrastive learning",
        "knowledge graph", "graph neural network", "quantization",
        "efficient inference", "retrieval augmented", "alignment",
        "mamba", "state space model", "lora", "peft", "instruction tuning",
        "hallucination", "factuality", "robustness", "adversarial",
        "object detection", "semantic segmentation", "image generation",
    ]:
        try:
            await turso_db.execute(
                "INSERT OR IGNORE INTO keywords (keyword, weight, category) VALUES (?, 1.0, 'ai')", [kw]
            )
        except Exception as e:
            logger.warning(f"Could not seed keyword '{kw}': {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("  AI Research Intelligence System  –  Starting Up")
    logger.info("=" * 60)

    # 1. Configure Turso
    turso_db.configure(settings.TURSO_DATABASE_URL, settings.TURSO_AUTH_TOKEN)

    # 2. Init schema (non-destructive)
    await init_db()

    # 3. Seed defaults
    await seed_defaults()

    # 4. Start scheduler
    start_scheduler()

    # 5. Check if full analysis has been run
    analysis_done = await get_system_config("ANALYSIS_COMPLETE")

    if analysis_done != "1":
        # First run: trigger full analysis pipeline in background
        total = await turso_db.count("papers")
        logger.info(f"First analysis needed – {total} papers in database")
        from app.tasks.analysis import run_full_analysis
        asyncio.create_task(run_full_analysis(force_rescore=False))
    else:
        # Subsequent starts: just score any new unscored papers
        unscored = await turso_db.count(
            "papers",
            "is_deleted = 0 AND is_duplicate = 0 AND (current_score IS NULL OR current_score = 0)"
        )
        if unscored > 0:
            logger.info(f"Found {unscored} unscored papers → background scoring")
            from app.tasks.paper_tasks import score_existing_papers
            asyncio.create_task(score_existing_papers())
        else:
            logger.info("All papers scored. System ready.")

    logger.info("Startup complete.")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    stop_scheduler()
    await turso_db.close()
    logger.info("System stopped.")


app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth.router,   prefix="/api")
app.include_router(feed.router,   prefix="/api")
app.include_router(papers.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(admin.router,  prefix="/api")


@app.get("/api/health")
async def health():
    try:
        total = await turso_db.count("papers")
        above = await turso_db.count("papers", "is_above_threshold = 1 AND is_deleted = 0 AND is_duplicate = 0")
        analysis = await get_system_config("ANALYSIS_COMPLETE")
        return {
            "status": "ok",
            "total_papers": total,
            "visible_papers": above,
            "analysis_complete": analysis == "1",
            "system": settings.APP_NAME,
        }
    except Exception as e:
        return {"status": "degraded", "error": str(e)}
