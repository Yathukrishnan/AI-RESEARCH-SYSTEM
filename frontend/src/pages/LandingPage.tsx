import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search, Flame, TrendingUp, Zap, Loader2,
  ArrowRight, Users, MessageSquare, Star, BookOpen,
  ChevronRight, LayoutGrid
} from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { landingApi, feedApi } from '@/lib/api'
import { LandingData, LandingPaper, LandingCategory } from '@/lib/types'
import { timeAgo, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ── Colour map for topic cards ────────────────────────────────────────────────
const TOPIC_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; glow: string }> = {
  blue:    { bg: 'bg-blue-500/5',    border: 'border-blue-500/20',    text: 'text-blue-300',    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/25',    glow: 'hover:shadow-blue-500/10' },
  pink:    { bg: 'bg-pink-500/5',    border: 'border-pink-500/20',    text: 'text-pink-300',    badge: 'bg-pink-500/15 text-pink-300 border-pink-500/25',    glow: 'hover:shadow-pink-500/10' },
  orange:  { bg: 'bg-orange-500/5',  border: 'border-orange-500/20',  text: 'text-orange-300',  badge: 'bg-orange-500/15 text-orange-300 border-orange-500/25',  glow: 'hover:shadow-orange-500/10' },
  green:   { bg: 'bg-green-500/5',   border: 'border-green-500/20',   text: 'text-green-300',   badge: 'bg-green-500/15 text-green-300 border-green-500/25',   glow: 'hover:shadow-green-500/10' },
  red:     { bg: 'bg-red-500/5',     border: 'border-red-500/20',     text: 'text-red-300',     badge: 'bg-red-500/15 text-red-300 border-red-500/25',     glow: 'hover:shadow-red-500/10' },
  cyan:    { bg: 'bg-cyan-500/5',    border: 'border-cyan-500/20',    text: 'text-cyan-300',    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',    glow: 'hover:shadow-cyan-500/10' },
  yellow:  { bg: 'bg-yellow-500/5',  border: 'border-yellow-500/20',  text: 'text-yellow-300',  badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',  glow: 'hover:shadow-yellow-500/10' },
  purple:  { bg: 'bg-purple-500/5',  border: 'border-purple-500/20',  text: 'text-purple-300',  badge: 'bg-purple-500/15 text-purple-300 border-purple-500/25',  glow: 'hover:shadow-purple-500/10' },
  emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-300', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', glow: 'hover:shadow-emerald-500/10' },
  slate:   { bg: 'bg-slate-500/5',   border: 'border-slate-500/20',   text: 'text-slate-300',   badge: 'bg-slate-500/15 text-slate-300 border-slate-500/25',   glow: 'hover:shadow-slate-500/10' },
}

// Social signal bar
function SocialBar({ paper }: { paper: LandingPaper }) {
  const hf = paper.hf_upvotes || 0
  const hn = paper.hn_points || 0
  const stars = paper.github_stars || 0
  const cit = paper.citation_count || 0
  if (!hf && !hn && !stars && !cit) return null
  return (
    <div className="flex items-center gap-3 text-xs text-muted/80">
      {hf > 0 && (
        <span className="flex items-center gap-1 text-orange-400/80">
          🤗 {hf.toLocaleString()}
        </span>
      )}
      {hn > 0 && (
        <span className="flex items-center gap-1 text-amber-400/80">
          🟠 {hn}
        </span>
      )}
      {stars > 0 && (
        <span className="flex items-center gap-1 text-yellow-400/80">
          <Star size={10} className="fill-yellow-400" />
          {stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}
        </span>
      )}
      {cit > 0 && (
        <span className="flex items-center gap-1 text-slate-400/80">
          📚 {cit}
        </span>
      )}
    </div>
  )
}

// ── Hero Section ──────────────────────────────────────────────────────────────
function HeroSection({ paper, onRead }: { paper: LandingPaper; onRead: () => void }) {
  const headline = paper.hook_text || paper.ai_lay_summary?.split('.')[0] || paper.title
  const why = paper.ai_why_important || paper.ai_summary
  const authors = paper.authors?.slice(0, 2).map(a => a.name).join(', ')

  return (
    <section className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-surface via-surface to-accent/5 p-8 md:p-10">
      {/* Glow effect */}
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative grid md:grid-cols-[1fr_auto] gap-8 items-start">
        <div className="space-y-5">
          {/* Breaking badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold tracking-wide animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              FEATURED TODAY
            </span>
            {paper.trend_label && (
              <span className="text-xs text-muted">{paper.trend_label}</span>
            )}
          </div>

          {/* Headline */}
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight tracking-tight">
            {truncate(headline, 120)}
          </h1>

          {/* Why important */}
          {why && (
            <p className="text-base text-muted leading-relaxed max-w-2xl">
              {truncate(why, 200)}
            </p>
          )}

          {/* Lay summary */}
          {paper.ai_lay_summary && (
            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl border-l-2 border-accent/30 pl-4">
              {truncate(paper.ai_lay_summary, 280)}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4">
            <SocialBar paper={paper} />
            {authors && (
              <span className="flex items-center gap-1 text-xs text-muted/60">
                <Users size={10} /> {authors}
              </span>
            )}
            <span className="text-xs text-muted/50">{timeAgo(paper.published_at)}</span>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onRead}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-background font-semibold text-sm rounded-xl hover:bg-accent/90 transition-all"
            >
              <BookOpen size={14} /> Read the Report
            </button>
            {paper.pdf_url && (
              <a
                href={paper.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-2 border border-accent/20 text-muted hover:text-white text-sm rounded-xl transition-all"
                onClick={e => e.stopPropagation()}
              >
                View Paper
              </a>
            )}
          </div>
        </div>

        {/* Score ring */}
        <div className="hidden md:flex flex-col items-center gap-2 shrink-0">
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-3" />
              <circle
                cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
                strokeDasharray={`${Math.round((paper.normalized_score || 0) * 251)} 251`}
                strokeLinecap="round"
                className="text-accent transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-white">{Math.round((paper.normalized_score || 0) * 100)}</span>
              <span className="text-[9px] text-muted uppercase tracking-wider">Score</span>
            </div>
          </div>
          <span className="text-xs text-muted">Research Quality</span>
        </div>
      </div>
    </section>
  )
}

// ── Breaking Strip ─────────────────────────────────────────────────────────────
function BreakingStrip({ papers, onSelect }: { papers: LandingPaper[]; onSelect: (p: LandingPaper) => void }) {
  if (!papers.length) return null
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Flame size={16} className="text-orange-400" />
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Most Discussed Right Now</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {papers.map((p, i) => {
          const headline = p.hook_text || p.ai_lay_summary?.split('.')[0] || p.title
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              onClick={() => onSelect(p)}
              className="group cursor-pointer bg-surface border border-accent/15 rounded-xl p-4 hover:border-accent/35 hover:bg-surface-2 transition-all"
            >
              <div className="flex items-start gap-2 mb-2">
                <span className="text-lg shrink-0">{['🔥','🟠','💡'][i]}</span>
                <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-accent-2 transition-colors">
                  {truncate(headline, 100)}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <SocialBar paper={p} />
                <ArrowRight size={12} className="text-muted group-hover:text-accent transition-colors shrink-0 ml-2" />
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

// ── Topic Category Card ────────────────────────────────────────────────────────
function TopicCard({ category, onTopicClick, onPaperClick }: {
  category: LandingCategory
  onTopicClick: () => void
  onPaperClick: (p: LandingPaper) => void
}) {
  const colors = TOPIC_COLORS[category.color] || TOPIC_COLORS.slate

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-300',
        colors.bg, colors.border, colors.glow, 'hover:shadow-lg'
      )}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between cursor-pointer group"
        onClick={onTopicClick}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{category.emoji}</span>
          <div>
            <h3 className={cn('text-base font-bold', colors.text)}>{category.label}</h3>
            <p className="text-xs text-muted mt-0.5 leading-relaxed max-w-[220px]">
              {category.tagline}
            </p>
          </div>
        </div>
        <ChevronRight size={16} className={cn('shrink-0 mt-1 transition-transform group-hover:translate-x-1', colors.text)} />
      </div>

      {/* Paper hooks */}
      <div className="space-y-2">
        {category.papers.slice(0, 3).map((paper) => {
          const headline = paper.hook_text || paper.ai_lay_summary?.split('.')[0] || paper.title
          return (
            <div
              key={paper.id}
              onClick={() => onPaperClick(paper)}
              className="group/item cursor-pointer flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0"
            >
              <span className="text-xs text-muted/40 w-4 shrink-0 mt-0.5 font-mono">›</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/85 leading-snug line-clamp-2 group-hover/item:text-white transition-colors">
                  {truncate(headline, 110)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <SocialBar paper={paper} />
                  <span className="text-[10px] text-muted/50 ml-auto shrink-0">{timeAgo(paper.published_at)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* See all CTA */}
      <button
        onClick={onTopicClick}
        className={cn(
          'flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
          'border border-white/10 hover:border-white/20 text-muted hover:text-white'
        )}
      >
        See all {category.paper_count} papers <ArrowRight size={11} />
      </button>
    </motion.div>
  )
}

// ── Search Bar ─────────────────────────────────────────────────────────────────
function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) onSearch(q.trim())
  }
  return (
    <form onSubmit={submit} className="relative max-w-2xl mx-auto">
      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder='Search any topic — e.g. "AI for cancer detection" or "faster chatbots"'
        className="w-full pl-10 pr-28 py-3.5 bg-surface border border-accent/20 rounded-2xl text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-accent text-background text-xs font-bold rounded-xl hover:bg-accent/90 transition-colors"
      >
        Search
      </button>
    </form>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function LandingPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<LandingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    landingApi.getLanding()
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const goToReport = (paper: LandingPaper) => navigate(`/report/${paper.id}`)
  const goToTopic = (topic: string) => navigate(`/explore/${topic}`)
  const goToSearch = (q: string) => navigate(`/search?q=${encodeURIComponent(q)}`)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Page header ── */}
      <div className="border-b border-accent/10 bg-gradient-to-b from-accent/3 to-transparent">
        <div className="max-w-6xl mx-auto px-4 py-10 text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-bold tracking-[0.25em] text-accent/70 uppercase mb-3">
              AI Research Intelligence
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
              What's happening in AI<br />
              <span className="text-accent">explained for everyone</span>
            </h1>
            <p className="text-muted text-base mt-4 max-w-xl mx-auto">
              The biggest ideas from AI research — curated, ranked, and explained in plain English.
              No PhD required.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="pt-2"
          >
            <SearchBar onSearch={goToSearch} />
          </motion.div>

          {/* Quick nav */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-2 flex-wrap pt-1"
          >
            {[
              { icon: Flame,      label: 'Trending',     path: '/papers/trending' },
              { icon: TrendingUp, label: 'Rising Fast',  path: '/papers/rising' },
              { icon: Zap,        label: 'Just Added',   path: '/papers/new' },
              { icon: LayoutGrid, label: 'All Papers',   path: '/papers/all' },
            ].map(({ icon: Icon, label, path }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted border border-accent/15 hover:border-accent/35 hover:text-white transition-all bg-surface/50"
              >
                <Icon size={11} /> {label}
              </button>
            ))}
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-accent border border-accent/25 hover:border-accent/50 hover:bg-accent/5 transition-all"
            >
              <LayoutGrid size={11} /> Researcher View →
            </button>
          </motion.div>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-6xl mx-auto px-4 py-10 space-y-12">
        {loading ? (
          <div className="flex flex-col items-center py-24 gap-3 text-muted">
            <Loader2 size={28} className="animate-spin text-accent" />
            <p className="text-sm">Loading today's intelligence…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-24 gap-3 text-center">
            <p className="text-white font-semibold">Couldn't load the feed</p>
            <button
              onClick={() => { setError(false); setLoading(true); landingApi.getLanding().then(r => setData(r.data)).catch(() => setError(true)).finally(() => setLoading(false)) }}
              className="text-xs text-accent hover:underline"
            >
              Retry
            </button>
          </div>
        ) : !data ? null : (
          <>
            {/* Hero */}
            {data.hero && (
              <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                <HeroSection paper={data.hero} onRead={() => goToReport(data.hero!)} />
              </motion.section>
            )}

            {/* Breaking strip */}
            {data.breaking.length > 0 && (
              <BreakingStrip papers={data.breaking} onSelect={goToReport} />
            )}

            {/* Topic categories */}
            {data.categories.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Browse by Topic</h2>
                    <p className="text-sm text-muted mt-1">Pick a field you're curious about</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {data.categories.map((cat, i) => (
                    <motion.div
                      key={cat.topic}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.07, 0.5), duration: 0.4 }}
                    >
                      <TopicCard
                        category={cat}
                        onTopicClick={() => goToTopic(cat.topic)}
                        onPaperClick={goToReport}
                      />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* No landing content yet — fallback CTA */}
            {!data.hero && data.categories.length === 0 && (
              <div className="flex flex-col items-center py-20 gap-4 text-center">
                <p className="text-white font-semibold text-lg">Content is warming up</p>
                <p className="text-muted text-sm max-w-md">
                  Our system is classifying and summarising papers for this view.
                  Check the researcher dashboard while we get ready.
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-5 py-2 bg-accent text-background rounded-xl text-sm font-semibold hover:bg-accent/90 transition-all"
                >
                  Go to Dashboard →
                </button>
              </div>
            )}

            {/* Footer nudge */}
            <div className="flex items-center justify-center pt-4 border-t border-accent/10">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-xs text-muted hover:text-white transition-colors"
              >
                <LayoutGrid size={12} />
                Switch to the full researcher dashboard with advanced scoring and analytics
                <ArrowRight size={12} />
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
