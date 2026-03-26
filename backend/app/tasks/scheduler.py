from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import logging

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="UTC")


async def _weekly_content_transition():
    """
    Runs every Monday at 00:05 UTC.
    Computes the current week number from SYSTEM_START_DATE and logs a transition
    event so the feed automatically exposes papers whose display_week <= current_week.
    No data mutation needed — the feed query already uses display_week <= current_week.
    """
    from app.core.database import get_system_config, set_system_config
    from app.core.turso import db as turso_db
    from datetime import datetime, timezone

    try:
        current_week_str = await get_system_config("CURRENT_WEEK")
        start_str = await get_system_config("SYSTEM_START_DATE")

        computed_week = 1
        if start_str:
            try:
                start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                if start.tzinfo is None:
                    start = start.replace(tzinfo=timezone.utc)
                days = (datetime.now(timezone.utc) - start).days
                computed_week = max(1, days // 7 + 1)
            except Exception:
                pass

        prev_week = int(current_week_str or 0)

        # Count papers that will become newly visible this week
        newly_visible = await turso_db.count(
            "papers",
            f"display_week = {computed_week} AND is_deleted = 0 AND is_duplicate = 0 AND is_above_threshold = 1"
        )

        logger.info(
            f"Weekly transition: week {prev_week} → {computed_week} | "
            f"{newly_visible} new papers becoming visible"
        )

        # Store computed week for reference (informational only)
        await set_system_config("CURRENT_WEEK", str(computed_week), "Current content week number")

        # Trigger a rescore so new papers get trend labels before users see them
        from app.tasks.paper_tasks import rescore_all_papers
        await rescore_all_papers()

    except Exception as e:
        logger.error(f"Weekly content transition error: {e}")


def setup_scheduler():
    from app.tasks.paper_tasks import fetch_and_store_papers, rescore_all_papers, enrich_pending_papers

    # Daily fetch at 8 AM IST (2:30 AM UTC) – new papers get display_week = current+1
    scheduler.add_job(
        fetch_and_store_papers,
        CronTrigger(hour=2, minute=30),
        id="daily_fetch",
        args=[1],
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Weekly rescore Sunday 2 AM UTC – recompute scores, trends, normalisation
    scheduler.add_job(
        rescore_all_papers,
        CronTrigger(day_of_week="sun", hour=2, minute=0),
        id="weekly_rescore",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Weekly content transition Monday 00:05 UTC – flip display week
    scheduler.add_job(
        _weekly_content_transition,
        CronTrigger(day_of_week="mon", hour=0, minute=5),
        id="weekly_content_transition",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Enrich unenriched papers every hour, 500 papers per run (batch API — ~50 papers/4s)
    scheduler.add_job(
        enrich_pending_papers,
        CronTrigger(minute=0),
        id="enrich_pending",
        args=[500],
        replace_existing=True,
        misfire_grace_time=600,
    )

    logger.info("Scheduler configured: daily_fetch(08:00), weekly_rescore(Sun 02:00), "
                "weekly_content_transition(Mon 00:05), enrich_pending(*/2h)")


def get_scheduler_status() -> list[dict]:
    """Return next-run info for all scheduled jobs."""
    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "id": job.id,
            "name": job.name or job.id,
            "next_run": next_run.isoformat() if next_run else None,
            "trigger": str(job.trigger),
        })
    return jobs


def start_scheduler():
    setup_scheduler()
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    scheduler.shutdown()
