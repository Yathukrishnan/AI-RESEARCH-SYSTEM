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


async def _daily_hook_generation():
    """Generate hooks for any papers still missing them. Runs daily at 03:15 UTC."""
    try:
        from app.tasks.paper_tasks import generate_missing_hooks
        count = await generate_missing_hooks(batch_size=500)
        logger.info(f"Daily hook generation: {count} hooks generated")
    except Exception as e:
        logger.error(f"Daily hook generation error: {e}")


async def _hourly_fetch_catchup():
    """
    Runs every hour. If today's daily_fetch hasn't completed yet AND it's
    past 02:30 UTC, trigger it now. This is a belt-and-braces guard for
    Render free tier: the service sleeps after 15 min of inactivity, killing
    APScheduler. When it wakes up on the next request, this hourly job fires
    and catches up the missed fetch — without waiting for a full restart.
    """
    from datetime import datetime, timezone as tz
    from app.core.turso import db as turso_db

    try:
        now = datetime.now(tz.utc)
        # Only attempt if it should have run already today
        if not (now.hour > 2 or (now.hour == 2 and now.minute >= 30)):
            return

        row = await turso_db.fetchone(
            "SELECT id FROM analysis_log "
            "WHERE run_type = 'daily_fetch' AND status = 'complete' "
            "AND date(started_at) = date('now') "
            "ORDER BY id DESC LIMIT 1"
        )
        if not row:
            logger.info("Hourly catch-up: today's fetch missing — triggering now")
            from app.tasks.paper_tasks import fetch_and_store_papers
            import asyncio
            asyncio.create_task(fetch_and_store_papers(1))
        else:
            logger.debug("Hourly catch-up: today's fetch already done")
    except Exception as e:
        logger.error(f"Hourly fetch catch-up error: {e}")


def setup_scheduler():
    from app.tasks.paper_tasks import fetch_and_store_papers, rescore_all_papers, enrich_pending_papers

    # Daily fetch at 8 AM IST (2:30 AM UTC) – new papers get display_week = current+1
    # misfire_grace_time=82800 (23 h): if server was down at 2:30 AM and wakes up any
    # time during the day, APScheduler will still fire the missed job immediately.
    # coalesce=True: if multiple runs were missed, execute only once (not N times).
    scheduler.add_job(
        fetch_and_store_papers,
        CronTrigger(hour=2, minute=30, timezone="UTC"),
        id="daily_fetch",
        args=[1],
        replace_existing=True,
        coalesce=True,
        misfire_grace_time=82800,
    )

    # Weekly rescore Sunday 2 AM UTC – recompute scores, trends, normalisation
    scheduler.add_job(
        rescore_all_papers,
        CronTrigger(day_of_week="sun", hour=2, minute=0, timezone="UTC"),
        id="weekly_rescore",
        replace_existing=True,
        coalesce=True,
        misfire_grace_time=82800,
    )

    # Weekly content transition: every Tuesday 00:05 UTC
    # New week starts → last week's fetched papers become visible in feed
    scheduler.add_job(
        _weekly_content_transition,
        CronTrigger(day_of_week="tue", hour=0, minute=5, timezone="UTC"),
        id="weekly_content_transition",
        replace_existing=True,
        coalesce=True,
        misfire_grace_time=82800,
    )

    # Enrich unenriched papers every hour, 500 papers per run (batch API — ~50 papers/4s)
    scheduler.add_job(
        enrich_pending_papers,
        CronTrigger(minute=0, timezone="UTC"),
        id="enrich_pending",
        args=[500],
        replace_existing=True,
        coalesce=True,
        misfire_grace_time=3600,
    )

    # Daily hook generation at 03:15 UTC — 45 min after daily fetch so new papers are scored
    scheduler.add_job(
        _daily_hook_generation,
        CronTrigger(hour=3, minute=15, timezone="UTC"),
        id="daily_hooks",
        replace_existing=True,
        coalesce=True,
        misfire_grace_time=82800,
    )

    # Hourly catch-up: re-fires today's fetch if it was missed (Render free tier sleep guard)
    scheduler.add_job(
        _hourly_fetch_catchup,
        CronTrigger(minute=35, timezone="UTC"),  # fires at :35 past each hour
        id="hourly_fetch_catchup",
        replace_existing=True,
        coalesce=True,
        misfire_grace_time=3600,
    )

    logger.info(
        "Scheduler configured: daily_fetch(02:30 UTC / 08:00 IST), "
        "daily_hooks(03:15 UTC), hourly_fetch_catchup(:35 each hour), "
        "weekly_rescore(Sun 02:00 UTC), weekly_content_transition(Mon 00:05 UTC), "
        "enrich_pending(hourly)"
    )


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
