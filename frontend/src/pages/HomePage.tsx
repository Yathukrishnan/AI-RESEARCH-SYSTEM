import { useEffect, useRef, useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { ResumeReading } from '@/components/feed/ResumeReading'
import { PaperCard } from '@/components/feed/PaperCard'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { FeedBanner } from '@/components/alerts/FeedBanner'
import { DigestFeed } from '@/components/feed/DigestFeed'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle, Search, X, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { feedApi } from '@/lib/api'
import { RippleButton } from '@/components/ui/MagicUI'
import { Ripple } from '@/components/ui/ripple'
import { AnimatedGradientText } from '@/components/ui/animated-gradient-text'

const CATEGORIES = [
  {
    type: 'trending',
    emoji: '🔥',
    label: 'Trending',
    hook: 'Top papers the field is reading right now',
    color: 'text-orange-400',
    bar: 'bg-orange-500',
  },
  {
    type: 'gems',
    emoji: '💎',
    label: 'Hidden Gems',
    hook: 'High-signal papers most have missed',
    color: 'text-purple-400',
    bar: 'bg-purple-500',
  },
  {
    type: 'new',
    emoji: '✨',
    label: 'New',
    hook: 'Latest arXiv submissions, freshly ranked',
    color: 'text-amber-400',
    bar: 'bg-amber-500',
  },
  {
    type: 'rising',
    emoji: '📈',
    label: 'Rising Fast',
    hook: 'Papers accelerating in the rankings',
    color: 'text-green-400',
    bar: 'bg-green-500',
  },
]

function CategoryAlerts() {
  const navigate = useNavigate()
  return (
    <div>
      <p className="text-[10px] font-mono font-bold text-muted/60 uppercase tracking-[0.15em] mb-3">
        Explore by category
      </p>
      {/* Grid with hairline separators — editorial style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/7 border border-white/7">
        {CATEGORIES.map((cat, i) => (
          <RippleButton
            key={cat.type}
            rippleColor="rgba(232,160,32,0.15)"
            onClick={() => navigate(`/papers/${cat.type}`)}
            className="flex items-center gap-4 px-5 py-4 bg-surface text-left group w-full"
          >
            <span className="text-xl shrink-0 select-none">{cat.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${cat.color} leading-none`}>{cat.label}</p>
              <p className="text-[11px] text-muted/60 mt-1 line-clamp-1 leading-snug">{cat.hook}</p>
            </div>
            <ArrowRight size={12} className="text-muted/25 group-hover:text-muted/60 transition-colors shrink-0" />
          </RippleButton>
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

function StatChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 border-r border-white/10 pr-4 last:border-0 last:pr-0">
      <span className={`text-[15px] font-black font-mono tabular-nums ${color}`}>{value.toLocaleString()}</span>
      <span className="text-[10px] font-mono text-muted/50 uppercase tracking-wider">{label}</span>
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

  useEffect(() => { fetchStats() }, [])

  useEffect(() => {
    if (!polling) return
    const t = setInterval(fetchStats, 10_000)
    return () => clearInterval(t)
  }, [polling])

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

      {/* Hero — editorial header block */}
      <div className="border-b border-white/7 relative overflow-hidden">
        {/* Magic UI Ripple — decorative concentric rings behind hero */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-64 h-64 pointer-events-none opacity-60">
          <Ripple mainCircleSize={60} mainCircleOpacity={0.18} numCircles={6} />
        </div>
        <div className="max-w-7xl mx-auto px-4 py-7 space-y-5 relative">

          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
              <p className="text-[10px] font-mono text-muted/50 uppercase tracking-[0.15em] mb-2">{getGreeting()}, researcher</p>
              <h1 className="text-[26px] sm:text-[30px] font-black text-white leading-tight tracking-tight">
                AI Research{' '}
                <AnimatedGradientText
                  colorFrom="#e8a020"
                  colorTo="#fbbf24"
                  className="font-black text-[26px] sm:text-[30px] leading-tight"
                >
                  Intelligence
                </AnimatedGradientText>
              </h1>
              <p className="text-[12px] font-mono text-muted/50 mt-1.5 uppercase tracking-widest">
                Discover · Explore · Stay ahead
              </p>
            </motion.div>

            {/* Stats — horizontal number strip */}
            {stats && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.12 }}
                className="flex items-center gap-4 shrink-0"
              >
                {stats.total_papers > 0 && (
                  <StatChip value={stats.total_papers} label="total" color="text-white/80" />
                )}
                {stats.visible_papers > 0 && (
                  <StatChip value={stats.visible_papers} label="visible" color="text-success" />
                )}
                {stats.trending_papers > 0 && (
                  <StatChip value={stats.trending_papers} label="trending" color="text-orange-400" />
                )}
              </motion.div>
            )}
          </div>

          {/* Search bar */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.12 }}>
            <div className="relative">
              <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by title, author, topic, category…"
                className="w-full bg-surface border border-white/10 rounded py-2.5 pl-9 pr-9 text-[13px] text-white placeholder-muted/35 focus:outline-none focus:border-accent/35 transition-colors"
              />
              {searchInput && (
                <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/40 hover:text-white transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
          </motion.div>

          {/* Feed banner — rotating hook */}
          {!isSearching && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.18 }}>
              <FeedBanner />
            </motion.div>
          )}
        </div>
      </div>

      {/* Analysis status */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="max-w-7xl mx-auto px-4 pt-4"
          >
            <div className="flex items-center gap-3 bg-accent/6 border border-accent/15 px-4 py-3">
              <Loader2 size={14} className="text-accent animate-spin shrink-0" />
              <div className="flex-1">
                <p className="text-[13px] text-white font-medium">
                  Analysing {stats?.total_papers?.toLocaleString()} papers
                </p>
                <p className="text-[11px] font-mono text-muted/50 mt-0.5">Scoring with AI · Auto-updates when complete</p>
              </div>
              <span className="text-[11px] font-mono text-accent/70 flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" /> Live
              </span>
            </div>
          </motion.div>
        )}
        {stats?.analysis_complete && (stats.visible_papers ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="max-w-7xl mx-auto px-4 pt-4"
          >
            <div className="flex items-center gap-2 border border-white/8 bg-surface px-4 py-2.5">
              <CheckCircle size={12} className="text-success shrink-0" />
              <p className="text-[11px] font-mono text-muted/60">
                <span className="text-white font-bold">{stats.visible_papers.toLocaleString()}</span> ranked ·{' '}
                <span className="text-orange-400 font-bold">{stats.trending_papers}</span> trending ·{' '}
                Week <span className="text-accent font-bold">{stats.current_week}</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {!isSearching && <CategoryAlerts />}
        {!isSearching && <ResumeReading />}
        {!isSearching && <DigestFeed />}

        {isSearching ? (
          /* ── Search results ── */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/7">
              {searchLoading && searchResults.length === 0 ? (
                <p className="text-[12px] font-mono text-muted/50 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Searching…
                </p>
              ) : (
                <p className="text-[12px] font-mono text-muted/60">
                  <span className="text-white font-bold">{searchTotal.toLocaleString()}</span> results for{' '}
                  <span className="text-accent font-bold">"{searchQuery}"</span>
                </p>
              )}
              <button onClick={clearSearch} className="text-[11px] font-mono text-muted/40 hover:text-white flex items-center gap-1 transition-colors">
                <X size={11} /> Clear
              </button>
            </div>

            {searchResults.length === 0 && !searchLoading ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Search size={36} className="text-muted/20 mb-4" />
                <p className="text-white font-bold mb-1">No results found</p>
                <p className="text-[12px] font-mono text-muted/50">Try a different title, author name, or topic tag</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-white/6">
                {searchResults.map((paper, i) => (
                  <PaperCard key={paper.id} paper={paper} index={i} />
                ))}
              </div>
            )}

            {searchHasMore && !searchLoading && (
              <div className="flex justify-center">
                <button
                  onClick={loadMoreSearch}
                  className="px-6 py-2.5 bg-surface border border-white/10 text-[12px] font-mono text-muted/60 hover:text-white hover:border-white/20 transition-all"
                >
                  Load more results
                </button>
              </div>
            )}
            {searchLoading && searchResults.length > 0 && (
              <div className="flex justify-center">
                <Loader2 size={16} className="animate-spin text-muted/40" />
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
