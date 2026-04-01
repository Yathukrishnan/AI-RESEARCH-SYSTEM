import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search, Flame, TrendingUp, Zap, Loader2,
  ArrowRight, LayoutGrid, ChevronRight
} from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { landingApi } from '@/lib/api'
import { LandingData, LandingPaper, LandingCategory } from '@/lib/types'
import { truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ── Colour map ────────────────────────────────────────────────────────────────
const COLORS: Record<string, {
  border: string; headerBg: string; headerText: string
  hookHover: string; pill: string; dot: string
}> = {
  blue:    { border: 'border-blue-500/20',    headerBg: 'bg-blue-500/8',    headerText: 'text-blue-300',    hookHover: 'hover:text-blue-200',    pill: 'bg-blue-500/15 border-blue-500/25 text-blue-300',    dot: 'bg-blue-400' },
  pink:    { border: 'border-pink-500/20',    headerBg: 'bg-pink-500/8',    headerText: 'text-pink-300',    hookHover: 'hover:text-pink-200',    pill: 'bg-pink-500/15 border-pink-500/25 text-pink-300',    dot: 'bg-pink-400' },
  orange:  { border: 'border-orange-500/20',  headerBg: 'bg-orange-500/8',  headerText: 'text-orange-300',  hookHover: 'hover:text-orange-200',  pill: 'bg-orange-500/15 border-orange-500/25 text-orange-300',  dot: 'bg-orange-400' },
  green:   { border: 'border-green-500/20',   headerBg: 'bg-green-500/8',   headerText: 'text-green-300',   hookHover: 'hover:text-green-200',   pill: 'bg-green-500/15 border-green-500/25 text-green-300',   dot: 'bg-green-400' },
  red:     { border: 'border-red-500/20',     headerBg: 'bg-red-500/8',     headerText: 'text-red-300',     hookHover: 'hover:text-red-200',     pill: 'bg-red-500/15 border-red-500/25 text-red-300',     dot: 'bg-red-400' },
  cyan:    { border: 'border-cyan-500/20',    headerBg: 'bg-cyan-500/8',    headerText: 'text-cyan-300',    hookHover: 'hover:text-cyan-200',    pill: 'bg-cyan-500/15 border-cyan-500/25 text-cyan-300',    dot: 'bg-cyan-400' },
  yellow:  { border: 'border-yellow-500/20',  headerBg: 'bg-yellow-500/8',  headerText: 'text-yellow-300',  hookHover: 'hover:text-yellow-200',  pill: 'bg-yellow-500/15 border-yellow-500/25 text-yellow-300',  dot: 'bg-yellow-400' },
  purple:  { border: 'border-purple-500/20',  headerBg: 'bg-purple-500/8',  headerText: 'text-purple-300',  hookHover: 'hover:text-purple-200',  pill: 'bg-purple-500/15 border-purple-500/25 text-purple-300',  dot: 'bg-purple-400' },
  emerald: { border: 'border-emerald-500/20', headerBg: 'bg-emerald-500/8', headerText: 'text-emerald-300', hookHover: 'hover:text-emerald-200', pill: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300', dot: 'bg-emerald-400' },
  slate:   { border: 'border-slate-500/20',   headerBg: 'bg-slate-500/8',   headerText: 'text-slate-300',   hookHover: 'hover:text-slate-200',   pill: 'bg-slate-500/15 border-slate-500/25 text-slate-300',   dot: 'bg-slate-400' },
}

function getHook(p: LandingPaper): string {
  return p.hook_text || p.ai_lay_summary?.split('.')[0] || p.title
}

// ── HERO — big hook, community badges, one CTA ───────────────────────────────
function Hero({ paper, onRead }: { paper: LandingPaper; onRead: () => void }) {
  const hook = getHook(paper)
  const hf = paper.hf_upvotes || 0
  const hn = paper.hn_points || 0
  const stars = paper.github_stars || 0

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-surface via-surface to-accent/5 p-8 md:p-10 cursor-pointer group"
      onClick={onRead}
    >
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent/4 rounded-full blur-3xl pointer-events-none" />

      <div className="relative space-y-5 max-w-3xl">
        {/* Live badge */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
            FEATURED TODAY
          </span>
          {paper.trend_label && (
            <span className="text-xs text-muted/60">{paper.trend_label}</span>
          )}
        </div>

        {/* The hook — large and prominent */}
        <h1 className="text-3xl md:text-[2.4rem] font-extrabold text-white leading-tight tracking-tight group-hover:text-accent-2 transition-colors">
          {truncate(hook, 160)}
        </h1>

        {/* Lay summary if available */}
        {paper.ai_lay_summary && (
          <p className="text-base text-slate-400 leading-relaxed border-l-2 border-accent/30 pl-4 max-w-2xl">
            {truncate(paper.ai_lay_summary, 220)}
          </p>
        )}

        {/* Community proof pills — only if non-zero */}
        {(hf > 0 || hn > 0 || stars > 0) && (
          <div className="flex flex-wrap gap-2">
            {hf > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/12 border border-orange-500/25 text-orange-300 text-sm font-medium">
                🤗 {hf.toLocaleString()} AI engineers discussing this
              </span>
            )}
            {hn > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/12 border border-amber-500/25 text-amber-300 text-sm font-medium">
                🟠 {hn} points on Hacker News
              </span>
            )}
            {stars > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/12 border border-yellow-500/25 text-yellow-300 text-sm font-medium">
                ⭐ {stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars} GitHub stars
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onRead}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-background font-semibold text-sm rounded-xl hover:bg-accent/90 transition-all"
          >
            Read the full report <ArrowRight size={14} />
          </button>
          <span className="text-xs text-muted/50">3 min read · no jargon</span>
        </div>
      </div>
    </motion.section>
  )
}

// ── BREAKING STRIP — 5 hooks in a scrollable row ─────────────────────────────
function BreakingStrip({ papers, onSelect }: { papers: LandingPaper[]; onSelect: (p: LandingPaper) => void }) {
  if (!papers.length) return null
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Flame size={14} className="text-orange-400" />
        <span className="text-xs font-bold tracking-widest text-orange-400/80 uppercase">Most Discussed Right Now</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {papers.slice(0, 6).map((p, i) => {
          const hook = getHook(p)
          const hf = p.hf_upvotes || 0
          const hn = p.hn_points || 0
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              onClick={() => onSelect(p)}
              className="group cursor-pointer rounded-xl border border-orange-500/15 bg-orange-500/3 hover:border-orange-500/35 hover:bg-orange-500/6 p-4 transition-all"
            >
              <p className="text-sm font-semibold text-white/90 leading-snug group-hover:text-white transition-colors line-clamp-3">
                {truncate(hook, 140)}
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                {hf > 0 && <span className="text-[11px] text-orange-400/70">🤗 {hf.toLocaleString()}</span>}
                {hn > 0 && <span className="text-[11px] text-amber-400/70">🟠 {hn}</span>}
                <span className="ml-auto text-[11px] text-muted/40 group-hover:text-orange-300/60 transition-colors flex items-center gap-0.5">
                  Read <ArrowRight size={9} />
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

// ── TOPIC CARD — header + 5 clickable hook lines ──────────────────────────────
function TopicCard({ cat, delay, onTopicClick, onPaperClick }: {
  cat: LandingCategory
  delay: number
  onTopicClick: () => void
  onPaperClick: (p: LandingPaper) => void
}) {
  const c = COLORS[cat.color] || COLORS.slate

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn('rounded-2xl border flex flex-col overflow-hidden', c.border)}
    >
      {/* Section header */}
      <div
        className={cn('flex items-center justify-between px-5 py-4 cursor-pointer group', c.headerBg)}
        onClick={onTopicClick}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{cat.emoji}</span>
          <div>
            <p className={cn('text-sm font-bold', c.headerText)}>{cat.label}</p>
            <p className="text-[11px] text-muted/60 mt-0.5">{cat.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', c.pill)}>
            {cat.paper_count} papers
          </span>
          <ChevronRight size={14} className={cn('transition-transform group-hover:translate-x-0.5', c.headerText)} />
        </div>
      </div>

      {/* Hook list — each hook is a clickable headline */}
      <div className="divide-y divide-white/5 flex-1">
        {cat.papers.map((p, i) => {
          const hook = getHook(p)
          const hf = p.hf_upvotes || 0
          const hn = p.hn_points || 0
          const isTrending = (p.trend_label || '').includes('🔥') || (p.trending_score || 0) > 0.4

          return (
            <div
              key={p.id}
              onClick={() => onPaperClick(p)}
              className={cn(
                'group flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-all',
                'hover:bg-white/3'
              )}
            >
              {/* Colour dot — trending papers get a pulsing indicator */}
              <div className="shrink-0 mt-1.5">
                {isTrending
                  ? <span className={cn('block w-2 h-2 rounded-full animate-pulse', c.dot)} />
                  : <span className="block w-2 h-2 rounded-full bg-white/10" />
                }
              </div>

              {/* Hook text */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm text-white/80 leading-snug transition-colors',
                  c.hookHover, 'group-hover:text-white'
                )}>
                  {truncate(hook, 130)}
                </p>

                {/* Social micro-proof — only when non-zero, very subtle */}
                {(hf > 0 || hn > 0) && (
                  <div className="flex items-center gap-2 mt-1">
                    {hf > 0 && <span className="text-[10px] text-orange-400/50">🤗 {hf > 999 ? `${(hf/1000).toFixed(1)}k` : hf}</span>}
                    {hn > 0 && <span className="text-[10px] text-amber-400/50">🟠 {hn}</span>}
                  </div>
                )}
              </div>

              <ArrowRight size={12} className="shrink-0 mt-1 text-white/10 group-hover:text-white/40 transition-colors" />
            </div>
          )
        })}
      </div>

      {/* Footer — see all */}
      <button
        onClick={onTopicClick}
        className={cn(
          'flex items-center justify-center gap-1.5 px-5 py-3 text-xs font-medium transition-all border-t border-white/5',
          'text-muted/60 hover:text-white hover:bg-white/3'
        )}
      >
        See all {cat.paper_count} {cat.label} papers <ArrowRight size={10} />
      </button>
    </motion.div>
  )
}

// ── SEARCH BAR ────────────────────────────────────────────────────────────────
function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState('')
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) onSearch(q.trim()) }
  return (
    <form onSubmit={submit} className="relative max-w-xl mx-auto">
      <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/60 pointer-events-none" />
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder='Try: "AI detects cancer" or "faster chatbots" or "robots learning"'
        className="w-full pl-10 pr-24 py-3 bg-surface border border-accent/20 rounded-2xl text-sm text-white placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors"
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-accent text-background text-xs font-bold rounded-xl hover:bg-accent/90 transition-colors"
      >
        Search
      </button>
    </form>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
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

  const goReport  = (p: LandingPaper)  => navigate(`/report/${p.id}`)
  const goTopic   = (topic: string)    => navigate(`/explore/${topic}`)
  const goSearch  = (q: string)        => navigate(`/search?q=${encodeURIComponent(q)}`)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Page header */}
      <div className="border-b border-accent/10">
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-5 text-center">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <p className="text-[11px] font-bold tracking-[0.3em] text-accent/60 uppercase mb-3">
              AI Research · Explained Simply
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
              What happened in AI today
            </h1>
            <p className="text-muted text-base mt-3 max-w-lg mx-auto">
              The most important ideas from AI research — explained in plain English, no PhD required.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
            <SearchBar onSearch={goSearch} />
          </motion.div>

          {/* Quick-nav pills */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {[
              { icon: Flame,       label: 'Trending',   path: '/papers/trending' },
              { icon: TrendingUp,  label: 'Rising Fast', path: '/papers/rising'  },
              { icon: Zap,         label: 'Just Added',  path: '/papers/new'     },
              { icon: LayoutGrid,  label: 'Researcher Dashboard', path: '/dashboard' },
            ].map(({ icon: Icon, label, path }) => (
              <button key={label} onClick={() => navigate(path)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted border border-accent/15 hover:border-accent/40 hover:text-white transition-all bg-surface/50"
              >
                <Icon size={10} /> {label}
              </button>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-10 space-y-12">
        {loading ? (
          <div className="flex flex-col items-center py-24 gap-3 text-muted">
            <Loader2 size={26} className="animate-spin text-accent" />
            <p className="text-sm">Loading today's research…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-24 gap-3">
            <p className="text-white font-semibold">Couldn't load the feed</p>
            <button onClick={() => { setError(false); setLoading(true); landingApi.getLanding().then(r => setData(r.data)).catch(() => setError(true)).finally(() => setLoading(false)) }}
              className="text-xs text-accent hover:underline"
            >Retry</button>
          </div>
        ) : !data ? null : (
          <>
            {/* Hero */}
            {data.hero && <Hero paper={data.hero} onRead={() => goReport(data.hero!)} />}

            {/* Breaking — community hot papers */}
            {data.breaking.length > 0 && (
              <BreakingStrip papers={data.breaking} onSelect={goReport} />
            )}

            {/* Topic categories */}
            {data.categories.length > 0 ? (
              <section>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-white">Browse by Topic</h2>
                  <p className="text-sm text-muted mt-1">
                    Pick what you're curious about — each card shows the most interesting hooks from that area
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {data.categories.map((cat, i) => (
                    <TopicCard
                      key={cat.topic}
                      cat={cat}
                      delay={Math.min(i * 0.07, 0.5)}
                      onTopicClick={() => goTopic(cat.topic)}
                      onPaperClick={goReport}
                    />
                  ))}
                </div>
              </section>
            ) : (
              /* Empty state — no categories yet */
              <div className="flex flex-col items-center py-16 gap-4 text-center border border-dashed border-accent/20 rounded-2xl">
                <span className="text-4xl">🔬</span>
                <p className="text-white font-semibold">Papers are loading in…</p>
                <p className="text-muted text-sm max-w-sm">
                  Content is being prepared. Try browsing the trending feed while you wait.
                </p>
                <button onClick={() => navigate('/papers/trending')}
                  className="px-5 py-2 bg-accent text-background rounded-xl text-sm font-semibold hover:bg-accent/90 transition-all"
                >
                  See Trending Papers →
                </button>
              </div>
            )}

            {/* Footer nudge to researcher view */}
            <div className="flex items-center justify-center pt-2 border-t border-accent/10 pb-4">
              <button onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-xs text-muted hover:text-white transition-colors"
              >
                <LayoutGrid size={11} />
                Switch to the full researcher dashboard with scores, analytics and filters
                <ArrowRight size={11} />
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
