/**
 * LandingPage — public-facing, non-technical entry point.
 *
 * Shows ONE journalist-style narrative hook per topic group.
 * No paper titles, no scores, no technical details.
 * Every element either clicks through to the topic page or hero report.
 *
 * Flow:  Landing  →  /explore/:topic  →  /report/:id  →  source paper
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Loader2, ArrowRight, ChevronRight, LayoutGrid } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { landingApi } from '@/lib/api'
import { LandingData, LandingCategory } from '@/lib/types'
import { cn } from '@/lib/utils'

// ── Colour tokens per topic ──────────────────────────────────────────────────
const COLORS: Record<string, {
  card: string; border: string; glow: string
  emojiRing: string; label: string; hook: string; cta: string
}> = {
  blue:    { card: 'bg-blue-950/30',    border: 'border-blue-500/20',    glow: 'hover:border-blue-400/35 hover:shadow-blue-500/8',    emojiRing: 'bg-blue-500/15 border-blue-500/25',    label: 'text-blue-300',    hook: 'text-white/85 hover:text-blue-100',    cta: 'text-blue-400/70 hover:text-blue-300' },
  pink:    { card: 'bg-pink-950/30',    border: 'border-pink-500/20',    glow: 'hover:border-pink-400/35 hover:shadow-pink-500/8',    emojiRing: 'bg-pink-500/15 border-pink-500/25',    label: 'text-pink-300',    hook: 'text-white/85 hover:text-pink-100',    cta: 'text-pink-400/70 hover:text-pink-300' },
  orange:  { card: 'bg-orange-950/30',  border: 'border-orange-500/20',  glow: 'hover:border-orange-400/35 hover:shadow-orange-500/8',  emojiRing: 'bg-orange-500/15 border-orange-500/25',  label: 'text-orange-300',  hook: 'text-white/85 hover:text-orange-100',  cta: 'text-orange-400/70 hover:text-orange-300' },
  green:   { card: 'bg-green-950/30',   border: 'border-green-500/20',   glow: 'hover:border-green-400/35 hover:shadow-green-500/8',   emojiRing: 'bg-green-500/15 border-green-500/25',   label: 'text-green-300',   hook: 'text-white/85 hover:text-green-100',   cta: 'text-green-400/70 hover:text-green-300' },
  red:     { card: 'bg-red-950/30',     border: 'border-red-500/20',     glow: 'hover:border-red-400/35 hover:shadow-red-500/8',     emojiRing: 'bg-red-500/15 border-red-500/25',     label: 'text-red-300',     hook: 'text-white/85 hover:text-red-100',     cta: 'text-red-400/70 hover:text-red-300' },
  cyan:    { card: 'bg-cyan-950/30',    border: 'border-cyan-500/20',    glow: 'hover:border-cyan-400/35 hover:shadow-cyan-500/8',    emojiRing: 'bg-cyan-500/15 border-cyan-500/25',    label: 'text-cyan-300',    hook: 'text-white/85 hover:text-cyan-100',    cta: 'text-cyan-400/70 hover:text-cyan-300' },
  yellow:  { card: 'bg-yellow-950/30',  border: 'border-yellow-500/20',  glow: 'hover:border-yellow-400/35 hover:shadow-yellow-500/8',  emojiRing: 'bg-yellow-500/15 border-yellow-500/25',  label: 'text-yellow-300',  hook: 'text-white/85 hover:text-yellow-100',  cta: 'text-yellow-400/70 hover:text-yellow-300' },
  purple:  { card: 'bg-purple-950/30',  border: 'border-purple-500/20',  glow: 'hover:border-purple-400/35 hover:shadow-purple-500/8',  emojiRing: 'bg-purple-500/15 border-purple-500/25',  label: 'text-purple-300',  hook: 'text-white/85 hover:text-purple-100',  cta: 'text-purple-400/70 hover:text-purple-300' },
  emerald: { card: 'bg-emerald-950/30', border: 'border-emerald-500/20', glow: 'hover:border-emerald-400/35 hover:shadow-emerald-500/8', emojiRing: 'bg-emerald-500/15 border-emerald-500/25', label: 'text-emerald-300', hook: 'text-white/85 hover:text-emerald-100', cta: 'text-emerald-400/70 hover:text-emerald-300' },
  slate:   { card: 'bg-slate-800/30',   border: 'border-slate-500/20',   glow: 'hover:border-slate-400/35 hover:shadow-slate-500/8',   emojiRing: 'bg-slate-500/15 border-slate-500/25',   label: 'text-slate-300',   hook: 'text-white/85 hover:text-slate-100',   cta: 'text-slate-400/70 hover:text-slate-300' },
}

// ── Topic Card ────────────────────────────────────────────────────────────────
// Shows only: emoji, topic label, journalist hook, paper count, "Explore" CTA
function TopicCard({ cat, index, onClick }: {
  cat: LandingCategory
  index: number
  onClick: () => void
}) {
  const c = COLORS[cat.color] || COLORS.slate
  // Use AI-generated hook from top paper if backend sends one,
  // otherwise use the static topic meta hook stored in cat.hook
  const narrativeHook: string = (cat as any).topic_hook || cat.tagline

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.55), duration: 0.45 }}
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer rounded-2xl border p-6 flex flex-col gap-4',
        'transition-all duration-300 hover:shadow-lg',
        c.card, c.border, c.glow
      )}
    >
      {/* Header: emoji ring + topic label + count badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={cn('w-11 h-11 rounded-xl border flex items-center justify-center text-2xl shrink-0', c.emojiRing)}>
            {cat.emoji}
          </span>
          <div>
            <p className={cn('text-sm font-bold tracking-wide', c.label)}>{cat.label}</p>
            <p className="text-[11px] text-muted/50 mt-0.5">
              {cat.paper_count} paper{cat.paper_count !== 1 ? 's' : ''} this week
            </p>
          </div>
        </div>
        <ChevronRight
          size={16}
          className={cn('shrink-0 transition-transform group-hover:translate-x-1', c.label)}
        />
      </div>

      {/* THE HOOK — the only text content that matters */}
      <p className={cn(
        'text-[1.05rem] font-medium leading-relaxed transition-colors flex-1',
        c.hook
      )}>
        {narrativeHook}
      </p>

      {/* CTA at the bottom */}
      <div className={cn('flex items-center gap-1.5 text-xs font-semibold transition-colors', c.cta)}>
        Read the stories <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </motion.article>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────
// The single most discussed paper — shown as a big narrative hook, nothing else
function HeroHook({ data, onRead }: { data: LandingData; onRead: () => void }) {
  const paper = data.hero
  if (!paper) return null

  const hook =
    (paper as any).ai_journalist_hook ||
    paper.hook_text ||
    paper.ai_lay_summary?.split('.')[0] ||
    paper.title

  const hf = paper.hf_upvotes || 0
  const hn = paper.hn_points || 0
  const stars = paper.github_stars || 0
  const hasSocial = hf > 0 || hn > 0 || stars > 0

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onClick={onRead}
      className="relative overflow-hidden cursor-pointer group rounded-3xl border border-accent/25 bg-gradient-to-br from-surface via-surface to-accent/5 px-8 py-10 md:px-12 md:py-12"
    >
      {/* Subtle glow */}
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-accent/4 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-3xl space-y-5">
        {/* Live badge */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
            TODAY'S TOP STORY
          </span>
        </div>

        {/* The hook — big */}
        <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight group-hover:text-accent-2 transition-colors">
          {hook}
        </h2>

        {/* Community scale — only if present, and only as human context */}
        {hasSocial && (
          <p className="text-sm text-slate-400 leading-relaxed">
            {hf > 0 && hn > 0
              ? `${hf.toLocaleString()} AI engineers bookmarked it and ${hn} developers discussed it on Hacker News — that's rare.`
              : hf > 0
              ? `${hf.toLocaleString()} AI engineers bookmarked this research this week.`
              : hn > 0
              ? `${hn} developers are discussing this right now on Hacker News.`
              : stars > 0
              ? `${stars.toLocaleString()} developers starred the code on GitHub.`
              : ''}
          </p>
        )}

        {/* CTA */}
        <button
          onClick={onRead}
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-background font-bold text-sm rounded-xl hover:bg-accent/90 transition-all"
        >
          Read the full story <ArrowRight size={14} />
        </button>
      </div>
    </motion.section>
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

// ── Main component ────────────────────────────────────────────────────────────
export function LandingPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<LandingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    landingApi.getLanding()
      .then(r => {
        // Attach topic_hook from topic_meta back to each category for the card
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Masthead ── */}
      <div className="border-b border-accent/10 bg-gradient-to-b from-accent/3 to-transparent">
        <div className="max-w-5xl mx-auto px-4 py-12 text-center space-y-5">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <p className="text-[10px] font-black tracking-[0.35em] text-accent/55 uppercase mb-3">
              AI Research · Explained For Everyone
            </p>
            <h1 className="text-4xl md:text-[3.2rem] font-extrabold text-white leading-tight tracking-tight">
              The biggest ideas in AI,<br />
              <span className="text-accent">in plain English</span>
            </h1>
            <p className="text-muted text-base mt-3 max-w-lg mx-auto leading-relaxed">
              Every day, thousands of AI research papers are published.
              We read them so you don't have to — and we tell you what actually matters.
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
            {/* Hero story */}
            {data.hero && (
              <HeroHook
                data={data}
                onRead={() => navigate(`/report/${data.hero!.id}`)}
              />
            )}

            {/* Topic grid — each card is ONE journalist hook, nothing else */}
            {data.categories.length > 0 ? (
              <section>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="mb-8 text-center space-y-1"
                >
                  <h2 className="text-2xl font-bold text-white">What's the world of AI working on?</h2>
                  <p className="text-sm text-muted">
                    Pick a topic that interests you — no technical knowledge required
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
