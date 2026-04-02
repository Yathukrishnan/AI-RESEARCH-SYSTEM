"""
Database schema initialization.
Creates tables and adds missing columns – NEVER drops existing data.
"""
import logging
from app.core.turso import db

logger = logging.getLogger(__name__)

# ── DDL ──────────────────────────────────────────────────────────────────────

CREATE_PAPERS = """
CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arxiv_id TEXT UNIQUE NOT NULL,
    hash_id TEXT,
    title TEXT NOT NULL,
    abstract TEXT,
    authors TEXT DEFAULT '[]',
    categories TEXT DEFAULT '[]',
    primary_category TEXT,
    published_at TEXT,
    updated_at TEXT,
    pdf_url TEXT,
    html_url TEXT,
    doi TEXT,
    journal_ref TEXT,
    citation_count INTEGER DEFAULT 0,
    influential_citation_count INTEGER DEFAULT 0,
    github_url TEXT,
    github_stars INTEGER DEFAULT 0,
    github_forks INTEGER DEFAULT 0,
    h_index_max REAL DEFAULT 0.0,
    ai_relevance_score REAL DEFAULT 0.0,
    ai_topic_tags TEXT DEFAULT '[]',
    ai_summary TEXT,
    ai_impact_score REAL DEFAULT 0.0,
    keyword_score REAL DEFAULT 0.0,
    current_score REAL DEFAULT 0.0,
    normalized_score REAL DEFAULT 0.0,
    score_type TEXT DEFAULT 'new',
    previous_score REAL DEFAULT 0.0,
    scr_value REAL DEFAULT 0.0,
    is_trending INTEGER DEFAULT 0,
    trend_label TEXT,
    display_week INTEGER DEFAULT 1,
    is_above_threshold INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    is_enriched INTEGER DEFAULT 0,
    is_ai_validated INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    is_duplicate INTEGER DEFAULT 0,
    stale_score_weeks INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_scored_at TEXT,
    last_enriched_at TEXT,
    hook_text TEXT
)
"""

CREATE_SCORE_HISTORY = """
CREATE TABLE IF NOT EXISTS score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id INTEGER NOT NULL,
    score REAL NOT NULL,
    score_type TEXT,
    scr_value REAL DEFAULT 0.0,
    scored_at TEXT DEFAULT (datetime('now'))
)
"""

CREATE_USERS = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    preferences TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
)
"""

CREATE_INTERACTIONS = """
CREATE TABLE IF NOT EXISTS user_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_id TEXT,
    paper_id INTEGER NOT NULL,
    action TEXT,
    created_at TEXT DEFAULT (datetime('now'))
)
"""

CREATE_ALERTS = """
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT,
    paper_id INTEGER,
    title TEXT,
    message TEXT,
    emoji TEXT DEFAULT '🚀',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
)
"""

CREATE_CONFIG = """
CREATE TABLE IF NOT EXISTS admin_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    is_editable INTEGER DEFAULT 1,
    is_protected INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
)
"""

CREATE_KEYWORDS = """
CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT UNIQUE NOT NULL,
    weight REAL DEFAULT 1.0,
    category TEXT DEFAULT 'general',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
)
"""

CREATE_ANALYSIS_LOG = """
CREATE TABLE IF NOT EXISTS analysis_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_type TEXT,
    status TEXT DEFAULT 'running',
    total_papers INTEGER DEFAULT 0,
    scored_papers INTEGER DEFAULT 0,
    duplicates_removed INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    finished_at TEXT,
    notes TEXT
)
"""

CREATE_SUBJECTS = """
CREATE TABLE IF NOT EXISTS arxiv_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_code TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
)
"""

CREATE_AUTHORS = """
CREATE TABLE IF NOT EXISTS paper_authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ss_author_id TEXT UNIQUE NOT NULL,
    name TEXT,
    h_index REAL DEFAULT 0.0,
    last_updated TEXT DEFAULT (datetime('now'))
)
"""

CREATE_DAILY_HOOKS = """
CREATE TABLE IF NOT EXISTS daily_hooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    paper_id INTEGER NOT NULL,
    hook_text TEXT NOT NULL,
    section_label TEXT DEFAULT '',
    hook_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
)
"""

# Columns to add if missing (safe migrations)
ENSURE_COLUMNS = [
    ("papers", "current_score",        "REAL",    "0.0"),
    ("papers", "normalized_score",     "REAL",    "0.0"),
    ("papers", "score_type",           "TEXT",    "'new'"),
    ("papers", "previous_score",       "REAL",    "0.0"),
    ("papers", "scr_value",            "REAL",    "0.0"),
    ("papers", "is_trending",          "INTEGER", "0"),
    ("papers", "trend_label",          "TEXT",    "NULL"),
    ("papers", "ai_relevance_score",   "REAL",    "0.0"),
    ("papers", "ai_impact_score",      "REAL",    "0.0"),
    ("papers", "ai_topic_tags",        "TEXT",    "NULL"),
    ("papers", "ai_summary",           "TEXT",    "NULL"),
    ("papers", "keyword_score",        "REAL",    "0.0"),
    ("papers", "citation_count",       "INTEGER", "0"),
    ("papers", "github_stars",         "INTEGER", "0"),
    ("papers", "github_forks",         "INTEGER", "0"),
    ("papers", "github_url",           "TEXT",    "NULL"),
    ("papers", "h_index_max",          "REAL",    "0.0"),
    ("papers", "display_week",         "INTEGER", "1"),
    ("papers", "is_above_threshold",   "INTEGER", "0"),
    ("papers", "view_count",           "INTEGER", "0"),
    ("papers", "save_count",           "INTEGER", "0"),
    ("papers", "click_count",          "INTEGER", "0"),
    ("papers", "is_enriched",          "INTEGER", "0"),
    ("papers", "is_ai_validated",      "INTEGER", "0"),
    ("papers", "is_deleted",           "INTEGER", "0"),
    ("papers", "is_duplicate",         "INTEGER", "0"),
    ("papers", "stale_score_weeks",    "INTEGER", "0"),
    ("papers", "hash_id",              "TEXT",    "NULL"),
    ("papers", "last_scored_at",       "TEXT",    "NULL"),
    ("papers", "last_enriched_at",     "TEXT",    "NULL"),
    ("papers", "hook_text",            "TEXT",    "NULL"),
    # keywords table migrations
    ("keywords", "weight",             "REAL",    "1.0"),
    ("keywords", "category",           "TEXT",    "'general'"),
    ("keywords", "is_active",          "INTEGER", "1"),
    ("keywords", "created_at",         "TEXT",    "NULL"),
    ("keywords", "topic_category",     "TEXT",    "'General'"),
    # arxiv_subjects migrations
    ("arxiv_subjects", "topic_category", "TEXT",  "'General'"),
    # papers columns that may be missing in existing Turso table
    ("papers", "published_at",         "TEXT",    "NULL"),
    ("papers", "categories",           "TEXT",    "NULL"),
    ("papers", "primary_category",     "TEXT",    "NULL"),
    ("papers", "updated_at",           "TEXT",    "NULL"),
    ("papers", "html_url",             "TEXT",    "NULL"),
    ("papers", "doi",                  "TEXT",    "NULL"),
    ("papers", "journal_ref",          "TEXT",    "NULL"),
    ("papers", "created_at",           "TEXT",    "NULL"),
    ("papers", "influential_citation_count", "INTEGER", "0"),
    # Social signal columns
    ("papers", "hf_upvotes",        "INTEGER", "0"),
    ("papers", "hn_points",         "INTEGER", "0"),
    ("papers", "hn_comments",       "INTEGER", "0"),
    ("papers", "citation_velocity", "REAL",    "0.0"),
    ("papers", "star_velocity",     "REAL",    "0.0"),
    ("papers", "trending_score",    "REAL",    "0.0"),
    ("papers", "rising_score",      "REAL",    "0.0"),
    ("papers", "gem_score",         "REAL",    "0.0"),
    ("papers", "platform_score",    "REAL",    "0.0"),
    ("papers", "social_checked_at", "TEXT",    "NULL"),
    # Public landing page AI fields
    ("papers", "ai_topic_category",  "TEXT",    "NULL"),
    ("papers", "ai_lay_summary",     "TEXT",    "NULL"),
    ("papers", "ai_why_important",   "TEXT",    "NULL"),
    ("papers", "ai_key_findings",    "TEXT",    "NULL"),
    ("papers", "ai_journalist_hook", "TEXT",    "NULL"),
]


async def init_db():
    logger.info("Initializing database schema…")

    # 1. Inspect existing tables
    existing_tables = await db.get_tables()
    logger.info(f"Existing tables: {existing_tables}")

    # 2. Create tables
    for ddl in [CREATE_PAPERS, CREATE_SCORE_HISTORY, CREATE_USERS,
                CREATE_INTERACTIONS, CREATE_ALERTS, CREATE_CONFIG,
                CREATE_KEYWORDS, CREATE_ANALYSIS_LOG, CREATE_SUBJECTS, CREATE_AUTHORS,
                CREATE_DAILY_HOOKS]:
        try:
            await db.execute(ddl)
        except Exception as e:
            logger.warning(f"DDL warning: {e}")

    # 3. Add missing columns to existing tables
    for table, col, typ, default in ENSURE_COLUMNS:
        if await db.table_exists(table):
            await db.add_column_if_missing(table, col, typ, default)

    # 4. Deduplicate keywords — keep only the lowest id per keyword (case-insensitive).
    #    Uses a self-join so it works on all SQLite/libSQL versions without non-standard
    #    GROUP BY behaviour. Runs on every boot but is a no-op when the table is clean.
    if await db.table_exists("keywords"):
        try:
            await db.execute(
                "DELETE FROM keywords WHERE id NOT IN ("
                "  SELECT MIN(k2.id) FROM keywords k2 GROUP BY lower(k2.keyword)"
                ")"
            )
        except Exception as e:
            logger.warning(f"Keyword dedup warning: {e}")

    # 5. Migrate published_date → published_at (for existing papers that predate our schema)
    if await db.table_exists("papers"):
        try:
            await db.execute(
                "UPDATE papers SET published_at = published_date WHERE published_at IS NULL AND published_date IS NOT NULL"
            )
        except Exception as e:
            logger.warning(f"published_date migration warning: {e}")

    logger.info("Schema ready.")


async def get_system_config(key: str, default: str = "") -> str:
    row = await db.fetchone("SELECT value FROM admin_config WHERE key = ?", [key])
    return row["value"] if row and row.get("value") else default


async def set_system_config(key: str, value: str, description: str = ""):
    existing = await db.fetchone("SELECT id FROM admin_config WHERE key = ?", [key])
    if existing:
        await db.execute("UPDATE admin_config SET value = ?, updated_at = datetime('now') WHERE key = ?", [value, key])
    else:
        await db.execute(
            "INSERT INTO admin_config (key, value, description, is_editable, is_protected) VALUES (?, ?, ?, 1, 0)",
            [key, value, description]
        )
