import axios from 'axios'

// In production (Vercel) VITE_API_URL points to the Render backend.
// In dev the Vite proxy forwards /api → localhost:8001.
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
})

function getSessionId(): string {
  let sid = localStorage.getItem('session_id')
  if (!sid) {
    sid = crypto.randomUUID()
    localStorage.setItem('session_id', sid)
  }
  return sid
}

api.interceptors.request.use((config) => {
  config.headers['X-Session-ID'] = getSessionId()
  const token = localStorage.getItem('auth_token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

// On 401: clear stale token and redirect to login so user isn't stuck
// seeing "Failed to fetch" on every admin panel load
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_role')
      localStorage.removeItem('user_email')
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const feedApi = {
  getFeed: (page = 0) => api.get(`/feed?page=${page}`),
  search: (q: string, page = 0) => api.get(`/search?q=${encodeURIComponent(q)}&page=${page}`),
  interact: (paperId: number, action: string) =>
    api.post(`/interact/${paperId}?action=${action}`),
  getStats: () => api.get('/stats'),
  getPapersByType: (type: string, page = 0) => api.get(`/papers/list?type=${type}&page=${page}`),
}

export const papersApi = {
  getDetail: (id: number) => api.get(`/paper/${id}`),
  getScoreHistory: (id: number) => api.get(`/paper/${id}/score-history`),
  getSimilar: (id: number) => api.get(`/similar/${id}`),
}

export const alertsApi = {
  getAlerts: () => api.get('/alerts'),
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, username: string, password: string) =>
    api.post('/auth/register', { email, username, password }),
}

export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  getAnalysisStatus: () => api.get('/admin/analysis/status'),
  runAnalysis: (force = false) => api.post(`/admin/analysis/run?force=${force}`),
  getPapers: (page = 0, sortBy = 'normalized_score') =>
    api.get(`/admin/papers?page=${page}&sort_by=${sortBy}`),
  deletePaper: (id: number) => api.delete(`/admin/papers/${id}`),
  addManualPaper: (arxivId: string) =>
    api.post('/admin/manual-paper', { arxiv_id: arxivId }),
  getConfig: () => api.get('/admin/config'),
  updateConfig: (key: string, value: string) =>
    api.post('/admin/config', { key, value }),
  getKeywords: () => api.get('/admin/keywords'),
  addKeyword: (keyword: string, weight: number, category: string) =>
    api.post('/admin/keywords', { keyword, weight, category }),
  deleteKeyword: (id: number) => api.delete(`/admin/keywords/${id}`),
  getSubjects: () => api.get('/admin/subjects'),
  addSubject: (subject_code: string, description: string) =>
    api.post('/admin/subjects', { subject_code, description }),
  deleteSubject: (id: number) => api.delete(`/admin/subjects/${id}`),
  toggleSubject: (id: number) => api.patch(`/admin/subjects/${id}/toggle`),
  generateHooks: (batch = 500, force = false) => api.post(`/admin/hooks/generate?batch_size=${batch}&force=${force}`),
  triggerFetch: (days = 1) => api.post(`/admin/trigger-fetch?days=${days}`),
  triggerRescore: () => api.post('/admin/trigger-rescore'),
  triggerEnrich: (batch = 50) => api.post(`/admin/trigger-enrich?batch=${batch}`),
  resetFailedEnrichment: () => api.post('/admin/reset-failed-enrichment'),
  getDailyFetch: () => api.get('/admin/daily-fetch'),
  getEnrichmentStatus: () => api.get('/admin/enrichment-status'),
  getSchedulerStatus: () => api.get('/admin/scheduler/status'),
  getUsers: () => api.get('/admin/users'),
  updateUserRole: (id: number, role: string) => api.patch(`/admin/users/${id}/role?role=${role}`),
  getDatasetSummary: () => api.get('/admin/dataset-summary'),
  getSocialSignals: () => api.get('/admin/social-signals'),
  triggerSocialSignals: (batch = 200) => api.post(`/admin/trigger-social-signals?batch=${batch}`),
  getApiHealth: () => api.get('/admin/api-health'),
  getServiceConfig: () => api.get('/admin/service-config'),
  triggerLandingContent: (batch = 100, force = false) =>
    api.post(`/admin/trigger-landing-content?batch=${batch}&force=${force}`),
  triggerRichHooks: (batch = 5000, force = false) =>
    api.post(`/admin/trigger-rich-hooks?batch=${batch}&force=${force}`),
  getRichHooksProgress: () => api.get('/admin/rich-hooks-progress'),
  getRichHooksStatus: () => api.get('/admin/rich-hooks-status'),
  getTopicCategories: () => api.get('/admin/topic-categories'),
  addTopicCategory: (data: { key: string; emoji: string; label: string; tagline: string; hook: string; color: string }) =>
    api.post('/admin/topic-categories', data),
  deleteTopicCategory: (key: string) => api.delete(`/admin/topic-categories/${encodeURIComponent(key)}`),
  restoreTopicCategory: (key: string) => api.patch(`/admin/topic-categories/${encodeURIComponent(key)}/restore`),
  getTopicsMapping: () => api.get('/admin/topics-mapping'),
  autoAssignTopics: () => api.post('/admin/auto-assign-topics'),
  setSubjectTopic: (id: number, topic: string) => api.patch(`/admin/subjects/${id}/topic`, { topic_category: topic }),
  setKeywordTopic: (id: number, topic: string) => api.patch(`/admin/keywords/${id}/topic`, { topic_category: topic }),
  paperQualityCheck: (arxivUrl: string) =>
    api.post('/admin/paper-quality-check', { arxiv_url: arxivUrl }),
  paperQualitySave: (paper: any, signals: any, scores: any) =>
    api.post('/admin/paper-quality-save', { paper, signals, scores }),
}

export const dashboardApi = {
  get: () => api.get('/dashboard'),
}

export const hooksApi = {
  getToday: () => api.get('/hooks/today'),
}

export const landingApi = {
  getLanding: () => api.get('/landing'),
  getTopic: (topic: string, page = 0) => api.get(`/landing/topic/${encodeURIComponent(topic)}?page=${page}`),
  getReport: (paperId: number) => api.get(`/report/${paperId}`),
}

export default api
