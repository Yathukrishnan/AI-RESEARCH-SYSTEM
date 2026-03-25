import math
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

NEW_PAPER_DAYS = 7

def _age_days(published_at) -> float:
    if not published_at:
        return 30.0
    try:
        if isinstance(published_at, str):
            published_at = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        if published_at.tzinfo is None:
            published_at = published_at.replace(tzinfo=timezone.utc)
        return max(0.0, (datetime.now(timezone.utc) - published_at).total_seconds() / 86400)
    except Exception:
        return 30.0

def _log_norm(value: float, scale: float = 100.0) -> float:
    if value <= 0:
        return 0.0
    return min(1.0, math.log(1 + value) / math.log(1 + scale))

def score_new_paper(row: dict, weights: Optional[Dict] = None) -> float:
    from app.core.config import settings
    w = weights or {}
    w1 = float(w.get("w_relevance", settings.W_RELEVANCE))
    w2 = float(w.get("w_author_h", settings.W_AUTHOR_H))
    w3 = float(w.get("w_git", settings.W_GIT))
    w4 = float(w.get("w_recency", settings.W_RECENCY))

    relevance = max(float(row.get("ai_relevance_score") or 0), float(row.get("keyword_score") or 0) * 0.5)
    author_h = _log_norm(float(row.get("h_index_max") or 0), 50)
    git = _log_norm(float(row.get("github_stars") or 0), 1000)
    age = _age_days(row.get("published_at"))
    recency = max(0.0, 1.0 - age / NEW_PAPER_DAYS)
    ai_impact = float(row.get("ai_impact_score") or 0)

    base = w1 * relevance + w2 * author_h + w3 * git + w4 * recency
    return round(min(1.0, base * (1 + 0.2 * ai_impact)), 4)

def score_old_paper(row: dict, weights: Optional[Dict] = None) -> float:
    from app.core.config import settings
    w = weights or {}
    w1 = float(w.get("w_citations", settings.W_CITATIONS))
    w2 = float(w.get("w_author_old", settings.W_AUTHOR_OLD))
    w3 = float(w.get("w_ai_impact", settings.W_AI_IMPACT))
    w4 = float(w.get("w_git_old", settings.W_GIT_OLD))
    lam = float(w.get("decay_lambda", settings.DECAY_LAMBDA))

    citations = _log_norm(float(row.get("citation_count") or 0), 500)
    author = _log_norm(float(row.get("h_index_max") or 0), 50)
    ai_impact = float(row.get("ai_impact_score") or 0)
    git = _log_norm(float(row.get("github_stars") or 0), 1000)
    age = _age_days(row.get("published_at"))
    decay = math.exp(-lam * age / 30)

    return round(min(1.0, (w1 * citations + w2 * author + w3 * ai_impact + w4 * git) * decay), 4)

def compute_score(row: dict, weights: Optional[Dict] = None) -> tuple:
    """Returns (score, score_type) for a paper dict."""
    age = _age_days(row.get("published_at"))
    if age <= NEW_PAPER_DAYS:
        return score_new_paper(row, weights), "new"
    return score_old_paper(row, weights), "old"

def compute_scr(new_score: float, old_score: float, hours: float) -> float:
    if hours <= 0:
        return 0.0
    return round((new_score - old_score) / max(hours, 1), 6)

def trend_label(scr: float, score: float, views: int, threshold: float) -> Optional[str]:
    if scr > threshold * 2:
        return "🔥 Trending"
    if scr > threshold:
        return "📈 Rising"
    if score > 0.7 and views < 50:
        return "💎 Hidden Gem"
    return None

def normalize_batch(papers: list) -> list:
    if not papers:
        return papers
    scores = [float(p.get("current_score") or 0) for p in papers]
    mn, mx = min(scores), max(scores)
    if mx == mn:
        for p in papers:
            p["normalized_score"] = 0.5
    else:
        for p in papers:
            p["normalized_score"] = round((float(p.get("current_score") or 0) - mn) / (mx - mn), 4)
    return papers
