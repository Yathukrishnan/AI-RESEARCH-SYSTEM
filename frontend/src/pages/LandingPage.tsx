/**
 * LandingPage — public-facing, non-technical entry point.
 *
 * Shows ONE journalist-style narrative hook per topic group.
 * No paper titles, no scores on topic cards.
 * Hero section shows full credibility scores + "View more" button.
 * Every element clicks through to the topic page or hero report.
 *
 * Flow:  Landing  →  /explore/:topic  →  /report/:id  →  source paper
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Loader2, ArrowRight, ChevronRight, LayoutGrid, Flame } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { landingApi } from '@/lib/api'
import { LandingData, LandingCategory, LandingPaper } from '@/lib/types'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/utils'

// ── Colour tokens per topic ───────────────────────────────────────────────────
const COLORS: Record<string, {
  card: string; border: string; glow: string
  emojiRing: string; label: string; hook: string; cta: string; pin: string
}> = {
  blue:    { card: 'bg-blue-950/30',    border: 'border-blue-500/20',    glow: 'hover:border-blue-400/40 hover:shadow-blue-500/10',    emojiRing: 'bg-blue-500/15 border-blue-500/25',    label: 'text-blue-300',    hook: 'text-white/85 hover:text-blue-100',    cta: 'text-blue-400',    pin: 'bg-blue-500/15 text-blue-300 border-blue-500/25' },
  pink:    { card: 'bg-pink-950/30',    border: 'border-pink-500/20',    glow: 'hover:border-pink-400/40 hover:shadow-pink-500/10',    emojiRing: 'bg-pink-500/15 border-pink-500/25',    label: 'text-pink-300',    hook: 'text-white/85 hover:text-pink-100',    cta: 'text-pink-400',    pin: 'bg-pink-500/15 text-pink-300 border-pink-500/25' },
  orange:  { card: 'bg-orange-950/30',  border: 'border-orange-500/20',  glow: 'hover:border-orange-400/40 hover:shadow-orange-500/10',  emojiRing: 'bg-orange-500/15 border-orange-500/25',  label: 'text-orange-300',  hook: 'text-white/85 hover:text-orange-100',  cta: 'text-orange-400',  pin: 'bg-orange-500/15 text-orange-300 border-orange-500/25' },
  green:   { card: 'bg-green-950/30',   border: 'border-green-500/20',   glow: 'hover:border-green-400/40 hover:shadow-green-500/10',   emojiRing: 'bg-green-500/15 border-green-500/25',   label: 'text-green-300',   hook: 'text-white/85 hover:text-green-100',   cta: 'text-green-400',   pin: 'bg-green-500/15 text-green-300 border-green-500/25' },
  red:     { card: 'bg-red-950/30',     border: 'border-red-500/20',     glow: 'hover:border-red-400/40 hover:shadow-red-500/10',     emojiRing: 'bg-red-500/15 border-red-500/25',     label: 'text-red-300',     hook: 'text-white/85 hover:text-red-100',     cta: 'text-red-400',     pin: 'bg-red-500/15 text-red-300 border-red-500/25' },
  cyan:    { card: 'bg-cyan-950/30',    border: 'border-cyan-500/20',    glow: 'hover:border-cyan-400/40 hover:shadow-cyan-500/10',    emojiRing: 'bg-cyan-500/15 border-cyan-500/25',    label: 'text-cyan-300',    hook: 'text-white/85 hover:text-cyan-100',    cta: 'text-cyan-400',    pin: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25' },
  yellow:  { card: 'bg-yellow-950/30',  border: 'border-yellow-500/20',  glow: 'hover:border-yellow-400/40 hover:shadow-yellow-500/10',  emojiRing: 'bg-yellow-500/15 border-yellow-500/25',  label: 'text-yellow-300',  hook: 'text-white/85 hover:text-yellow-100',  cta: 'text-yellow-400',  pin: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25' },
  purple:  { card: 'bg-purple-950/30',  border: 'border-purple-500/20',  glow: 'hover:border-purple-400/40 hover:shadow-purple-500/10',  emojiRing: 'bg-purple-500/15 border-purple-500/25',  label: 'text-purple-300',  hook: 'text-white/85 hover:text-purple-100',  cta: 'text-purple-400',  pin: 'bg-purple-500/15 text-purple-300 border-purple-500/25' },
  emerald: { card: 'bg-emerald-950/30', border: 'border-emerald-500/20', glow: 'hover:border-emerald-400/40 hover:shadow-emerald-500/10', emojiRing: 'bg-emerald-500/15 border-emerald-500/25', label: 'text-emerald-300', hook: 'text-white/85 hover:text-emerald-100', cta: 'text-emerald-400', pin: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  slate:   { card: 'bg-slate-800/30',   border: 'border-slate-500/20',   glow: 'hover:border-slate-400/40 hover:shadow-slate-500/10',   emojiRing: 'bg-slate-500/15 border-slate-500/25',   label: 'text-slate-300',   hook: 'text-white/85 hover:text-slate-100',   cta: 'text-slate-400',   pin: 'bg-slate-500/15 text-slate-300 border-slate-500/25' },
}

// ── Score pill ────────────────────────────────────────────────────────────────
function ScorePill({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 bg-white/4 border border-white/8 rounded-xl min-w-[60px]">
      <span className="text-base leading-none">{icon}</span>
      <span className="text-sm font-extrabold text-white tabular-nums leading-tight">{value}</span>
      <span className="text-[9px] text-muted/50 leading-tight text-center">{label}</span>
    </div>
  )
}

// ── Topic Card ────────────────────────────────────────────────────────────────
function TopicCard({ cat, index, onClick }: {
  cat: LandingCategory
  index: number
  onClick: () => void
}) {
  const c = COLORS[cat.color] || COLORS.slate
  const narrativeHook: string = (cat as any).topic_hook || cat.tagline

  const ctaText = 'The top papers are here — check it out →'

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.55), duration: 0.45 }}
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer rounded-2xl border p-6 flex flex-col gap-4',
        'transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5',
        c.card, c.border, c.glow
      )}
    >
      {/* Header: emoji ring + topic label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={cn('w-11 h-11 rounded-xl border flex items-center justify-center text-2xl shrink-0', c.emojiRing)}>
            {cat.emoji}
          </span>
          <p className={cn('text-sm font-bold tracking-wide', c.label)}>{cat.label}</p>
        </div>
        <ChevronRight size={16} className={cn('shrink-0 transition-transform group-hover:translate-x-1', c.label)} />
      </div>

      {/* THE HOOK — journalist narrative for this topic */}
      <p className={cn('text-[1.05rem] font-medium leading-relaxed transition-colors flex-1', c.hook)}>
        {narrativeHook}
      </p>

      {/* CTA */}
      <div className={cn('flex items-center gap-1.5 text-xs font-semibold transition-all group-hover:gap-2', c.cta)}>
        {ctaText}
      </div>
    </motion.article>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function HeroSection({ data, onRead, onViewMore }: {
  data: LandingData
  onRead: () => void
  onViewMore: () => void
}) {
  const paper = data.hero
  if (!paper) return null

  const fullHook =
    (paper as any).ai_journalist_hook ||
    paper.hook_text ||
    paper.ai_lay_summary ||
    paper.title

  // Split into sentences — show only first as the headline
  const hookSentences = fullHook.split(/(?<=[.!?])\s+(?=[A-Z"'])/).filter(Boolean)
  const hook = hookSentences[0] || fullHook
  const hookSubtext = hookSentences.slice(1, 3).join(' ')

  const hf    = paper.hf_upvotes || 0
  const hn    = paper.hn_points || 0
  const hnC   = (paper as any).hn_comments || 0
  const stars = paper.github_stars || 0
  const cit   = paper.citation_count || 0
  const hIdx  = paper.h_index_max || 0
  const qual  = Math.round((paper.normalized_score || 0) * 100)

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
  const anyScore = hf > 0 || hn > 0 || stars > 0 || cit > 0 || hIdx > 0

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-surface via-surface to-accent/5"
    >
      {/* Subtle glow */}
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-accent/4 rounded-full blur-3xl pointer-events-none" />

      <div className="relative px-8 py-10 md:px-12 md:py-12 space-y-6">
        {/* Badge */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
            TODAY'S TOP STORY
          </span>
          {paper.trend_label && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs">
              {paper.trend_label}
            </span>
          )}
        </div>

        {/* Hook — big headline, click to read */}
        <div
          onClick={onRead}
          className="cursor-pointer group/hook max-w-3xl"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight group-hover/hook:text-accent/90 transition-colors">
            {hook}
          </h2>
          {(hookSubtext || paper.ai_lay_summary) && (
            <p className="mt-3 text-base text-slate-400/80 leading-relaxed line-clamp-2">
              {hookSubtext || paper.ai_lay_summary}
            </p>
          )}
        </div>

        {/* Credibility scores — only non-zero values */}
        {anyScore && (
          <div className="flex flex-wrap gap-2">
            {hf > 0 && <ScorePill icon="🤗" value={fmt(hf)} label="HF upvotes" />}
            {hn > 0 && <ScorePill icon="🟠" value={hnC > 0 ? `${hn}·${hnC}` : String(hn)} label="Hacker News" />}
            {cit > 0 && <ScorePill icon="📚" value={fmt(cit)} label="Citations" />}
            {stars > 0 && <ScorePill icon="⭐" value={fmt(stars)} label="GitHub stars" />}
            {hIdx > 0 && <ScorePill icon="🧑‍🔬" value={`h-${Math.round(hIdx)}`} label="H-index" />}
            {qual > 0 && <ScorePill icon="✦" value={`${qual}/100`} label="Quality" />}
          </div>
        )}

        <p className="text-xs text-muted/40">{timeAgo(paper.published_at)}</p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={onRead}
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-background font-bold text-sm rounded-xl hover:bg-accent/90 transition-all"
          >
            Read the full story <ArrowRight size={14} />
          </button>
          <button
            onClick={onViewMore}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white/6 border border-white/10 text-white/70 hover:text-white hover:border-white/20 font-medium text-sm rounded-xl transition-all"
          >
            <Flame size={13} className="text-orange-400" />
            View more top stories
          </button>
        </div>
      </div>
    </motion.section>
  )
}

// ── Top Discussing Papers strip ───────────────────────────────────────────────
// Shows the 'breaking' papers (top community signal) with scores + view more
function TopDiscussing({ papers, onRead, onViewAll }: {
  papers: LandingPaper[]
  onRead: (id: number) => void
  onViewAll: () => void
}) {
  if (!papers.length) return null

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-orange-400" />
          <h2 className="text-base font-bold text-white">Most discussed right now</h2>
        </div>
        <button
          onClick={onViewAll}
          className="text-xs text-accent hover:underline flex items-center gap-1"
        >
          View all <ArrowRight size={10} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {papers.slice(0, 6).map((p, i) => {
          const hook = (p as any).ai_journalist_hook || p.hook_text || p.title
          const hf    = p.hf_upvotes || 0
          const hn    = p.hn_points || 0
          const stars = p.github_stars || 0
          const cit   = p.citation_count || 0
          const hIdx  = p.h_index_max || 0
          const qual  = Math.round((p.normalized_score || 0) * 100)
          const anyScore = hf > 0 || hn > 0 || stars > 0 || cit > 0

          // Split hook sentences for headline + subtext
          const sents = hook.split(/(?<=[.!?])\s+(?=[A-Z"'])/).filter(Boolean)

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onRead(p.id)}
              className="group cursor-pointer bg-surface border border-accent/10 rounded-2xl p-4 hover:border-accent/25 hover:bg-surface-2 transition-all space-y-3"
            >
              {/* Hook headline */}
              <p className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors leading-snug line-clamp-2">
                {sents[0] || hook}
              </p>
              {sents[1] && (
                <p className="text-xs text-muted/55 leading-snug line-clamp-2">{sents[1]}</p>
              )}

              {/* Mini score pills */}
              {anyScore && (
                <div className="flex flex-wrap gap-1">
                  {hf > 0 && <span className="text-[9px] bg-orange-500/10 border border-orange-500/20 text-orange-400/80 rounded-full px-1.5 py-0.5">🤗 {fmt(hf)}</span>}
                  {hn > 0 && <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400/80 rounded-full px-1.5 py-0.5">🟠 {hn}</span>}
                  {cit > 0 && <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400/80 rounded-full px-1.5 py-0.5">📚 {fmt(cit)}</span>}
                  {stars > 0 && <span className="text-[9px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-400/80 rounded-full px-1.5 py-0.5">⭐ {fmt(stars)}</span>}
                  {hIdx > 0 && <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400/80 rounded-full px-1.5 py-0.5">🧑‍🔬 h-{Math.round(hIdx)}</span>}
                  {qual > 0 && <span className="text-[9px] bg-accent/10 border border-accent/20 text-accent/80 rounded-full px-1.5 py-0.5">✦ {qual}/100</span>}
                </div>
              )}

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-muted/35">{timeAgo(p.published_at)}</span>
                <ArrowRight size={10} className="text-muted/30 group-hover:text-accent transition-colors" />
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="flex justify-center pt-1">
        <button
          onClick={onViewAll}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface border border-accent/15 text-muted hover:text-white hover:border-accent/30 text-xs rounded-xl transition-all"
        >
          See all trending stories <ArrowRight size={11} />
        </button>
      </div>
    </section>
  )
}

// ── Search bar ────────────────────────────────────────────────────────────────
function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) onSearch(q.trim())
  }
  return (
    <form onSubmit={submit} className="relative max-w-xl mx-auto">
      <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none" />
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder='Ask anything — "AI and cancer" · "faster phones" · "climate predictions"'
        className="w-full pl-11 pr-24 py-3.5 bg-surface border border-accent/20 rounded-2xl text-sm text-white placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors"
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 bg-accent text-background text-xs font-bold rounded-xl hover:bg-accent/90 transition-colors"
      >
        Search
      </button>
    </form>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function LandingPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<LandingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    landingApi.getLanding()
      .then(r => {
        const d = r.data as LandingData & { topic_meta?: Record<string, any> }
        if (d.topic_meta && d.categories) {
          d.categories = d.categories.map(cat => ({
            ...cat,
            topic_hook: (d.topic_meta as any)[cat.topic]?.hook || cat.tagline,
          }))
        }
        setData(d)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const retry = () => {
    setError(false)
    setLoading(true)
    landingApi.getLanding().then(r => setData(r.data)).catch(() => setError(true)).finally(() => setLoading(false))
  }

  // Navigate to the trending topic (most papers) for "view more"
  const viewMoreTrending = () => {
    if (!data?.categories?.length) return
    const top = [...data.categories].sort((a, b) => b.paper_count - a.paper_count)[0]
    navigate(`/explore/${top.topic}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Masthead ── */}
      <div className="border-b border-accent/10 bg-gradient-to-b from-accent/3 to-transparent">
        <div className="max-w-5xl mx-auto px-4 py-12 text-center space-y-5">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <p className="text-[10px] font-black tracking-[0.35em] text-accent/55 uppercase mb-3">
              The AI Research Magazine
            </p>
            <h1 className="text-4xl md:text-[3.2rem] font-extrabold text-white leading-tight tracking-tight">
              AI is changing everything.<br />
              <span className="text-accent">Here's what's actually happening.</span>
            </h1>
            <p className="text-muted text-base mt-3 max-w-lg mx-auto leading-relaxed">
              Every week, the world's brightest researchers publish breakthroughs that will shape the next decade.
              We turn the science into stories anyone can understand.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
            <SearchBar onSearch={q => navigate(`/search?q=${encodeURIComponent(q)}`)} />
          </motion.div>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-5xl mx-auto px-4 py-10 space-y-14">
        {loading ? (
          <div className="flex flex-col items-center py-28 gap-3 text-muted">
            <Loader2 size={26} className="animate-spin text-accent" />
            <p className="text-sm">Loading today's stories…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-28 gap-4">
            <p className="text-white font-semibold">Couldn't load stories</p>
            <button onClick={retry} className="text-xs text-accent hover:underline">Retry</button>
          </div>
        ) : !data ? null : (
          <>
            {/* Hero — top story with full credibility scores */}
            {data.hero && (
              <HeroSection
                data={data}
                onRead={() => navigate(`/report/${data.hero!.id}`)}
                onViewMore={viewMoreTrending}
              />
            )}

            {/* Most discussed papers strip */}
            {(data as any).breaking?.length > 0 && (
              <TopDiscussing
                papers={(data as any).breaking}
                onRead={id => navigate(`/report/${id}`)}
                onViewAll={viewMoreTrending}
              />
            )}

            {/* Topic grid */}
            {data.categories.length > 0 ? (
              <section>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="mb-8 text-center space-y-2"
                >
                  <h2 className="text-2xl font-bold text-white">What's the world of AI working on?</h2>
                  <p className="text-sm text-muted">
                    Pick a topic that interests you — no technical knowledge required.
                    Top papers updated daily.
                  </p>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {data.categories.map((cat, i) => (
                    <TopicCard
                      key={cat.topic}
                      cat={cat}
                      index={i}
                      onClick={() => navigate(`/explore/${cat.topic}`)}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <div className="flex flex-col items-center py-16 gap-4 text-center border border-dashed border-accent/20 rounded-2xl">
                <span className="text-5xl">🔬</span>
                <p className="text-white font-semibold text-lg">Stories are loading in…</p>
                <p className="text-muted text-sm max-w-sm">
                  Try browsing the trending research feed while content warms up.
                </p>
                <button
                  onClick={() => navigate('/papers/trending')}
                  className="px-5 py-2 bg-accent text-background rounded-xl text-sm font-semibold hover:bg-accent/90 transition-all"
                >
                  See Trending Papers →
                </button>
              </div>
            )}

            {/* Footer nudge for researchers */}
            <div className="flex items-center justify-center gap-2 pt-2 pb-6 border-t border-accent/10 text-xs text-muted">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <LayoutGrid size={11} />
                Researcher? Switch to the full technical dashboard
                <ArrowRight size={11} />
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
