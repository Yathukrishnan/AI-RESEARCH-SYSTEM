from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any, Dict
from datetime import datetime

# Auth schemas
class UserCreate(BaseModel):
    email: str
    username: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str

# Paper schemas
class AuthorSchema(BaseModel):
    name: str
    affiliation: Optional[str] = None
    h_index: Optional[float] = None

class PaperBase(BaseModel):
    arxiv_id: str
    title: str
    abstract: Optional[str] = None
    authors: List[Dict] = []
    categories: List[str] = []
    published_at: Optional[datetime] = None
    pdf_url: Optional[str] = None

class PaperCard(BaseModel):
    id: int
    arxiv_id: str
    title: str
    abstract: Optional[str] = None
    authors: List[Dict] = []
    categories: List[str] = []
    primary_category: Optional[str] = None
    published_at: Optional[datetime] = None
    pdf_url: Optional[str] = None
    github_url: Optional[str] = None
    current_score: float = 0.0
    normalized_score: float = 0.0
    is_trending: bool = False
    trend_label: Optional[str] = None
    scr_value: float = 0.0
    ai_topic_tags: List[str] = []
    ai_summary: Optional[str] = None
    citation_count: int = 0
    github_stars: int = 0
    view_count: int = 0
    save_count: int = 0

    class Config:
        from_attributes = True

class PaperDetail(PaperCard):
    doi: Optional[str] = None
    journal_ref: Optional[str] = None
    h_index_max: float = 0.0
    ai_relevance_score: float = 0.0
    ai_impact_score: float = 0.0
    keyword_score: float = 0.0
    score_type: str = "new"
    previous_score: float = 0.0
    last_scored_at: Optional[datetime] = None
    score_breakdown: Optional[Dict] = None

    class Config:
        from_attributes = True

class ScoreHistoryItem(BaseModel):
    score: float
    score_type: str
    scr_value: float
    scored_at: datetime

    class Config:
        from_attributes = True

# Feed schemas
class FeedSection(BaseModel):
    section_type: str  # "trending", "rising", "new", "hidden_gems", "personalized"
    title: str
    emoji: str
    papers: List[PaperCard]
    total: int

class FeedResponse(BaseModel):
    sections: List[FeedSection]
    current_week: int
    current_page: int
    has_more: bool
    total_papers: int
    alerts: List[Dict] = []

# Alert schemas
class AlertResponse(BaseModel):
    id: int
    alert_type: str
    title: str
    message: str
    emoji: str
    paper_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Admin schemas
class ConfigUpdate(BaseModel):
    key: str
    value: str

class KeywordCreate(BaseModel):
    keyword: str
    weight: float = 1.0
    category: str = "general"

class ManualPaperAdd(BaseModel):
    arxiv_id: str

class ScoringWeightsUpdate(BaseModel):
    w_relevance: Optional[float] = None
    w_author_h: Optional[float] = None
    w_git: Optional[float] = None
    w_recency: Optional[float] = None
    w_citations: Optional[float] = None
    w_author_old: Optional[float] = None
    w_ai_impact: Optional[float] = None
    w_git_old: Optional[float] = None
    decay_lambda: Optional[float] = None
    scr_threshold: Optional[float] = None
