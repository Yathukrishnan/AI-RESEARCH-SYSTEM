export interface Author {
  name: string
  affiliation?: string
  h_index?: number
}

export interface PaperCard {
  id: number
  arxiv_id: string
  title: string
  abstract?: string
  authors: Author[]
  categories: string[]
  primary_category?: string
  published_at?: string
  pdf_url?: string
  github_url?: string
  current_score: number
  normalized_score: number
  is_trending: boolean
  trend_label?: string
  scr_value: number
  ai_topic_tags: string[]
  ai_summary?: string
  hook_text?: string
  citation_count: number
  github_stars: number
  view_count: number
  save_count: number
}

export interface PaperDetail extends PaperCard {
  html_url?: string
  doi?: string
  journal_ref?: string
  h_index_max: number
  ai_relevance_score: number
  ai_impact_score: number
  keyword_score: number
  score_type: string
  previous_score: number
  updated_at?: string
  last_scored_at?: string
  score_breakdown?: ScoreBreakdown
}

export interface ScoreBreakdown {
  ai_relevance: number
  ai_impact: number
  keyword_score: number
  citation_count: number
  github_stars: number
  h_index_max: number
  score_type: string
  scr_value: number
}

export interface ScoreHistoryItem {
  score: number
  score_type: string
  scr_value: number
  scored_at: string
}

export interface FeedSection {
  section_type: 'trending' | 'rising' | 'new' | 'hidden_gems' | 'personalized' | 'you_missed'
  title: string
  emoji: string
  papers: PaperCard[]
  total: number
}

export interface FeedResponse {
  sections: FeedSection[]
  current_week: number
  current_page: number
  has_more: boolean
  total_papers: number
  alerts?: Alert[]
}

export interface Alert {
  id?: number
  type: string
  emoji: string
  title: string
  message: string
  paper_id?: number
  navigate_to?: 'trending' | 'gems' | 'new' | 'all'
  created_at?: string
}

export interface Keyword {
  id: number
  keyword: string
  weight: number
  category: string
  is_active: boolean
}

export interface Subject {
  id: number
  subject_code: string
  description: string
  is_active: number
}

export interface ConfigItem {
  key: string
  value: string
  description: string
  updated_at?: string
}

export interface AdminStats {
  total_papers: number
  trending_papers: number
  enriched_papers: number
  ai_validated_papers: number
  visible_papers: number
  scored_papers: number
  duplicate_papers: number
}

export interface AnalysisLog {
  id: number
  run_type: string
  status: string
  total_papers: number
  scored_papers: number
  duplicates_removed: number
  errors: number
  started_at: string
  finished_at?: string
  notes?: string
}

export interface AdminUser {
  id: number
  email: string
  username: string
  role: string
  is_active: number
  created_at?: string
}

export interface DashboardPaper {
  id: number
  arxiv_id?: string
  title: string
  abstract?: string
  authors: { name: string; affiliation?: string; h_index?: number }[]
  categories: string[]
  primary_category?: string
  published_at?: string
  pdf_url?: string
  github_url?: string
  github_stars: number
  citation_count: number
  h_index_max?: number
  normalized_score: number
  current_score: number
  trend_label?: string
  ai_topic_tags: string[]
  ai_summary?: string
  hook_text?: string
  hf_upvotes?: number
  hn_points?: number
  hn_comments?: number
  citation_velocity?: number
  trending_score?: number
  rising_score?: number
  gem_score?: number
  platform_score?: number
  view_count: number
  save_count: number
  click_count?: number
  score_history?: number[]
}

export interface DashboardData {
  hero: DashboardPaper | null
  hype_carousel: DashboardPaper[]
  intelligence_grid: DashboardPaper[]
  under_the_radar: DashboardPaper[]
  builders_arsenal: DashboardPaper[]
  velocity_desk: DashboardPaper[]
  theory_corner: DashboardPaper[]
  contrarian_view: DashboardPaper[]
}

export interface DailyHook {
  id: number
  hook_text: string
  section_label: string
  hook_order: number
  title: string
  paper_id: number
}
