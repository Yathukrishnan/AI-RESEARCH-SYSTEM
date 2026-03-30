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


def compute_trending_score(row: dict) -> float:
    """Social velocity signal: HF upvotes + HN discussion + citation velocity."""
    hf = _log_norm(float(row.get("hf_upvotes") or 0), 100)
    hn = _log_norm(
        float(row.get("hn_points") or 0) + float(row.get("hn_comments") or 0) * 0.5,
        200
    )
    cit_vel = min(1.0, max(0.0, float(row.get("citation_velocity") or 0)))
    age = _age_days(row.get("published_at"))
    freshness = math.exp(-0.05 * max(0.0, age))  # decays over ~20 days
    raw = 0.40 * hf + 0.30 * hn + 0.30 * cit_vel
    return round(min(1.0, raw * (1.0 + 0.5 * freshness)), 4)


def compute_rising_score(row: dict) -> float:
    """Momentum signal: citation velocity + HF growth + quality baseline."""
    cit_vel = min(1.0, max(0.0, float(row.get("citation_velocity") or 0)))
    star_vel = min(1.0, max(0.0, float(row.get("star_velocity") or 0)))
    hf = _log_norm(float(row.get("hf_upvotes") or 0), 100)
    quality = float(row.get("normalized_score") or 0)
    age = _age_days(row.get("published_at"))
    decay = math.exp(-0.02 * max(0.0, age - 7))  # moderate decay after 1 week
    raw = 0.40 * cit_vel + 0.25 * star_vel + 0.20 * hf + 0.15 * quality
    return round(min(1.0, raw * decay), 4)


def compute_gem_score(row: dict) -> float:
    """Hidden gem: high quality × low external attention."""
    quality = float(row.get("normalized_score") or 0)
    views = float(row.get("view_count") or 0)
    saves = float(row.get("save_count") or 0)
    hf = float(row.get("hf_upvotes") or 0)
    hn = float(row.get("hn_points") or 0)
    # Attention = how much external visibility the paper already has
    attention = min(1.0, (views / 100.0 + saves / 20.0 + hf / 50.0 + hn / 50.0) / 4.0)
    return round(min(1.0, quality * quality * (1.0 - attention * 0.8)), 4)


def compute_platform_score(row: dict) -> float:
    """In-app engagement: views, saves, clicks."""
    views = _log_norm(float(row.get("view_count") or 0), 500)
    saves = _log_norm(float(row.get("save_count") or 0), 50)
    clicks = _log_norm(float(row.get("click_count") or 0), 100)
    return round(min(1.0, 0.50 * views + 0.30 * saves + 0.20 * clicks), 4)


def compute_all_category_scores(row: dict) -> dict:
    """Compute all four category scores from a paper row."""
    return {
        "trending_score": compute_trending_score(row),
        "rising_score":   compute_rising_score(row),
        "gem_score":      compute_gem_score(row),
        "platform_score": compute_platform_score(row),
    }


def compute_blended_score(row: dict, weights: Optional[Dict] = None) -> tuple:
    """
    Final paper score = base (70%) + social boost (30%).

    Social boost is only applied when the paper has actual social signal data
    (HF upvotes, HN activity, or citation velocity).  Papers with no social
    data yet get the pure base score so early-life scoring is unaffected.

    Social boost formula:
        social = 0.50 × trending_score + 0.30 × rising_score + 0.20 × platform_score
        final  = 0.70 × base + 0.30 × social

    gem_score is excluded from the blend — it is used only for trend-label
    assignment (Hidden Gem), not for ranking.

    Returns (score, score_type).
    """
    base, score_type = compute_score(row, weights)

    hf = float(row.get("hf_upvotes") or 0)
    hn = float(row.get("hn_points") or 0) + float(row.get("hn_comments") or 0)
    cv = float(row.get("citation_velocity") or 0)

    if hf > 0 or hn > 0 or cv > 0:
        ts = compute_trending_score(row)
        rs = compute_rising_score(row)
        ps = compute_platform_score(row)
        social = 0.50 * ts + 0.30 * rs + 0.20 * ps
        blended = 0.70 * base + 0.30 * social
        return round(min(1.0, blended), 4), score_type

    return base, score_type
