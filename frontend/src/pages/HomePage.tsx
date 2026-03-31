import { useEffect, useRef, useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { ResumeReading } from '@/components/feed/ResumeReading'
import { PaperCard } from '@/components/feed/PaperCard'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { FeedBanner } from '@/components/alerts/FeedBanner'
import { motion, AnimatePresence } from 'framer-motion'
import { Database, Eye, Flame, Loader2, CheckCircle, Search, X, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { feedApi } from '@/lib/api'

const CATEGORIES = [
  {
    type: 'trending',
    emoji: '🔥',
    label: 'Trending Papers',
    hook: 'Top papers the field is reading right now',
    reason: 'Ranked by citation velocity, HF upvotes, HN points & GitHub stars — the most-discussed papers across AI communities this week.',
    border: 'border-orange-500/25',
    bg: 'hover:bg-orange-500/8',
    badgeBg: 'bg-orange-500/10',
    color: 'text-orange-400',
  },
  {
    type: 'gems',
    emoji: '💎',
    label: 'Hidden Gems',
    hook: 'High-signal papers most have missed',
    reason: 'High normalized score but under 30 views — strong research signal before the crowd finds it. Ranked by quality, filtered for low exposure.',
    border: 'border-purple-500/25',
    bg: 'hover:bg-purple-500/8',
    badgeBg: 'bg-purple-500/10',
    color: 'text-purple-400',
  },
  {
    type: 'new',
    emoji: '✨',
    label: 'New Papers',
    hook: 'Latest arXiv submissions, freshly ranked',
    reason: 'Papers added to the feed in the last 7 days, scored by our AI pipeline — citation count, author h-index, topic relevance, and community signals.',
    border: 'border-cyan-500/25',
    bg: 'hover:bg-cyan-500/8',
    badgeBg: 'bg-cyan-500/10',
    color: 'text-cyan-400',
  },
  {
    type: 'rising',
    emoji: '📈',
    label: 'Rising Fast',
    hook: 'Papers accelerating in the rankings',
    reason: 'Re-scored in the last 3 days with increasing momentum — these papers are gaining traction faster than their peers. Catch them before they peak.',
    border: 'border-green-500/25',
    bg: 'hover:bg-green-500/8',
    badgeBg: 'bg-green-500/10',
    color: 'text-green-400',
  },
]

function CategoryAlerts() {
  const navigate = useNavigate()
  return (
    <div>
      <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-3">Explore by category</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {CATEGORIES.map((cat) => (
          <motion.button
            key={cat.type}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/papers/${cat.type}`)}
            className={`flex flex-col items-start gap-3 p-4 rounded-xl border bg-surface/50 ${cat.border} ${cat.bg} transition-colors cursor-pointer text-left group`}
          >
            {/* Header */}
            <div className="flex items-center justify-between w-full">
              <span className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full ${cat.badgeBg} ${cat.color}`}>
                <span className="text-base leading-none">{cat.emoji}</span> {cat.label}
              </span>
              <ArrowRight size={13} className="text-muted group-hover:text-white transition-colors shrink-0" />
            </div>
            {/* Hook */}
            <p className="text-sm font-bold text-white leading-snug">{cat.hook}</p>
            {/* Reason — why this category exists */}
            <p className="text-[11px] text-slate-400 leading-relaxed">{cat.reason}</p>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

interface Stats {
  total_papers: number
  visible_papers: number
  trending_papers: number
  current_week: number
  analysis_complete: boolean
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function StatChip({ icon: Icon, value, label, color, border }: {
  icon: React.ElementType; value: number; label: string; color: string; border: string
}) {
  return (
    <div className={`flex items-center gap-2 bg-surface border ${border} rounded-xl px-3 py-2 text-xs`}>
      <Icon size={13} className={color} />
      <span className="text-white font-semibold tabular-nums">{value.toLocaleString()}</span>
      <span className="text-muted">{label}</span>
    </div>
  )
}

export function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [polling, setPolling] = useState(false)

  // Search
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchPage, setSearchPage] = useState(0)
  const [searchHasMore, setSearchHasMore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchStats = async () => {
    try {
      const res = await feedApi.getStats()
      setStats(res.data)
      setPolling(!res.data.analysis_complete)
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    if (!polling) return
    const t = setInterval(fetchStats, 10_000)
    return () => clearInterval(t)
  }, [polling])

  // Search logic
  const runSearch = async (q: string, page = 0, append = false) => {
    if (q.length < 2) return
    setSearchLoading(true)
    try {
      const res = await feedApi.search(q, page)
      const data = res.data
      setSearchResults((prev) => append ? [...prev, ...data.papers] : data.papers)
      setSearchHasMore(data.has_more)
      setSearchTotal(data.total ?? data.papers.length)
    } catch { /* silent */ } finally {
      setSearchLoading(false)
    }
  }

  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) {
      setSearchQuery('')
      setSearchResults([])
      return
    }
    debounceRef.current = setTimeout(() => {
      setSearchQuery(val.trim())
      setSearchPage(0)
      runSearch(val.trim(), 0)
    }, 350)
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
    setSearchResults([])
    setSearchPage(0)
  }

  const loadMoreSearch = () => {
    const next = searchPage + 1
    setSearchPage(next)
    runSearch(searchQuery, next, true)
  }

  const isSearching = searchQuery.length >= 2
  const isAnalyzing = stats && !stats.analysis_complete

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero section */}
      <div className="relative overflow-hidden border-b border-accent/10">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-12 left-1/4 w-96 h-64 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute -top-8 right-1/3 w-72 h-48 bg-cyan-500/4 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-8 space-y-5">
          {/* Title + stats */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
              <p className="text-xs text-muted mb-1">{getGreeting()}, researcher</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                AI Research <span className="text-gradient">Intelligence</span>
              </h1>
              <p className="text-muted text-sm mt-1">Discover · Explore · Stay ahead of AI research</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="flex flex-wrap gap-2"
            >
              {stats?.total_papers ? (
                <StatChip icon={Database} value={stats.total_papers} label="total" color="text-accent-2" border="border-accent/20" />
              ) : null}
              {stats?.visible_papers ? (
                <StatChip icon={Eye} value={stats.visible_papers} label="visible" color="text-success" border="border-success/20" />
              ) : null}
              {stats?.trending_papers ? (
                <StatChip icon={Flame} value={stats.trending_papers} label="trending" color="text-orange-400" border="border-orange-500/20" />
              ) : null}
            </motion.div>
          </div>

          {/* Search bar */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by title, author, topic, category…"
                className="w-full bg-surface border border-accent/20 rounded-xl py-2.5 pl-9 pr-10 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 transition-all"
              />
              {searchInput && (
                <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          </motion.div>

          {/* Feed banner — daily hooks + category tiles */}
          {!isSearching && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
              <FeedBanner />
            </motion.div>
          )}
        </div>
      </div>

      {/* Analysis status banner */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="max-w-7xl mx-auto px-4 pt-4"
          >
            <div className="flex items-center gap-3 bg-accent/10 border border-accent/25 rounded-xl px-4 py-3">
              <Loader2 size={15} className="text-accent-2 animate-spin shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-white font-medium">
                  Analysing {stats?.total_papers?.toLocaleString()} papers in background
                </p>
                <p className="text-xs text-muted">Scoring, ranking with AI · Auto-updates when complete</p>
              </div>
              <span className="text-xs text-accent-2 bg-accent/15 px-2 py-1 rounded-lg shrink-0 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-accent-2 rounded-full animate-pulse" /> Live
              </span>
            </div>
          </motion.div>
        )}
        {stats?.analysis_complete && (stats.visible_papers ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="max-w-7xl mx-auto px-4 pt-4"
          >
            <div className="flex items-center gap-2 bg-success/5 border border-success/15 rounded-xl px-4 py-2">
              <CheckCircle size={13} className="text-success shrink-0" />
              <p className="text-xs text-slate-400">
                <span className="text-white font-semibold">{stats.visible_papers.toLocaleString()}</span> papers ranked ·{' '}
                <span className="text-orange-400 font-semibold">{stats.trending_papers}</span> trending ·{' '}
                Week <span className="text-accent-2 font-semibold">{stats.current_week}</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-5">
        {!isSearching && <CategoryAlerts />}
        {!isSearching && <ResumeReading />}

        {isSearching ? (
          /* ── Search results ── */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              {searchLoading && searchResults.length === 0 ? (
                <p className="text-sm text-muted flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin" /> Searching…
                </p>
              ) : (
                <p className="text-sm text-muted">
                  <span className="text-white font-semibold">{searchTotal.toLocaleString()}</span> results for{' '}
                  <span className="text-accent-2 font-semibold">"{searchQuery}"</span>
                </p>
              )}
              <button onClick={clearSearch} className="text-xs text-muted hover:text-white flex items-center gap-1 transition-colors">
                <X size={12} /> Clear
              </button>
            </div>

            {searchResults.length === 0 && !searchLoading ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Search size={40} className="text-muted mb-4 opacity-30" />
                <p className="text-white font-semibold mb-1">No results found</p>
                <p className="text-muted text-sm">Try a different title, author name, or topic tag</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {searchResults.map((paper, i) => (
                  <PaperCard key={paper.id} paper={paper} index={i} />
                ))}
              </div>
            )}

            {searchHasMore && !searchLoading && (
              <div className="flex justify-center">
                <button
                  onClick={loadMoreSearch}
                  className="px-6 py-2.5 bg-surface border border-accent/20 text-sm text-muted hover:text-white hover:border-accent/40 rounded-xl transition-all"
                >
                  Load more results
                </button>
              </div>
            )}
            {searchLoading && searchResults.length > 0 && (
              <div className="flex justify-center">
                <Loader2 size={18} className="animate-spin text-muted" />
              </div>
            )}
          </div>
        ) : (
          /* ── Intelligence Dashboard ── */
          <Dashboard />
        )}
      </main>
    </div>
  )
}
