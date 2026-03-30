/**
 * FeedBanner — single combined component replacing both HookRotator + AlertBanner.
 *
 * Row 1: Auto-rotating daily hooks (paper headlines, cycle every 6 s).
 * Row 2: Three category tiles — Trending / Hidden Gems / New Papers.
 *         Each tile click → /papers/:type list page.
 */
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Flame, Gem, Zap, TrendingUp, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { hooksApi, feedApi } from '@/lib/api'
import { DailyHook } from '@/lib/types'

const ROTATE_MS = 6000

// ── Category tiles ────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    type: 'trending',
    emoji: '🔥',
    icon: Flame,
    label: 'Trending Papers',
    hooks: [
      'Top-ranked papers the field is reading right now',
      'The AI community is moving fast — see what\'s hot',
      'High-signal papers climbing the rankings',
      'What researchers are citing and sharing this week',
      'Papers with the most community momentum',
    ],
    color: 'text-orange-400',
    border: 'border-orange-500/25',
    bg: 'hover:bg-orange-500/8 bg-orange-500/4',
  },
  {
    type: 'gems',
    emoji: '💎',
    icon: Gem,
    label: 'Hidden Gems',
    hooks: [
      'High-impact work that hasn\'t gone viral — yet',
      'Strong signal, low noise — undiscovered research',
      'Brilliant papers flying under the radar',
      'Before everyone else finds these',
      'Overlooked papers with exceptional scores',
    ],
    color: 'text-purple-400',
    border: 'border-purple-500/25',
    bg: 'hover:bg-purple-500/8 bg-purple-500/4',
  },
  {
    type: 'new',
    emoji: '✨',
    icon: Zap,
    label: 'New Papers',
    hooks: [
      'Fresh arXiv submissions, scored and ranked',
      'Latest research just landed in the feed',
      'New papers added since yesterday',
      'Just in — newest AI & ML pre-prints',
      'Hot off the press — today\'s new additions',
    ],
    color: 'text-cyan-400',
    border: 'border-cyan-500/25',
    bg: 'hover:bg-cyan-500/8 bg-cyan-500/4',
  },
  {
    type: 'rising',
    emoji: '📈',
    icon: TrendingUp,
    label: 'Rising Fast',
    hooks: [
      'Papers gaining momentum across the field',
      'Rising stars in this week\'s rankings',
      'Scores accelerating — papers to watch',
      'Early movers gaining traction right now',
      'These papers are climbing fast',
    ],
    color: 'text-green-400',
    border: 'border-green-500/25',
    bg: 'hover:bg-green-500/8 bg-green-500/4',
  },
]

// Pick a hook for a category tile based on today's date (rotates daily)
function getDailyHook(hooks: string[]): string {
  const dayIndex = Math.floor(Date.now() / 86400000) // days since epoch
  return hooks[dayIndex % hooks.length]
}

// ── Hook rotator row ──────────────────────────────────────────────────────────
function HookRow() {
  const [hooks, setHooks] = useState<DailyHook[]>([])
  const [current, setCurrent] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    hooksApi.getToday()
      .then((r) => setHooks(r.data?.hooks || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (hooks.length <= 1) return
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % hooks.length)
    }, ROTATE_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [hooks.length])

  if (!hooks.length || dismissed) return null

  const hook = hooks[current]

  // Color based on section_label
  const style = hook.section_label.includes('Trending')
    ? 'border-orange-500/30 bg-orange-500/5'
    : hook.section_label.includes('Gems')
    ? 'border-purple-500/30 bg-purple-500/5'
    : hook.section_label.includes('Added')
    ? 'border-cyan-500/30 bg-cyan-500/5'
    : hook.section_label.includes('Rising')
    ? 'border-green-500/30 bg-green-500/5'
    : 'border-accent/25 bg-accent/5'

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (timerRef.current) clearInterval(timerRef.current)
    setCurrent((c) => (c - 1 + hooks.length) % hooks.length)
  }
  const next = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (timerRef.current) clearInterval(timerRef.current)
    setCurrent((c) => (c + 1) % hooks.length)
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28 }}
        onClick={() => hook.paper_id && navigate(`/paper/${hook.paper_id}`)}
        className={`w-full rounded-xl px-4 py-3 border flex items-center gap-3 cursor-pointer group ${style}`}
      >
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/8 text-white/80 whitespace-nowrap shrink-0">
          {hook.section_label}
        </span>
        <p className="flex-1 text-sm text-white font-semibold leading-tight line-clamp-1 group-hover:text-white/80 transition-colors">
          {hook.hook_text}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          {hooks.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 mr-1">
              {hooks.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${i === current ? 'w-4 h-1.5 bg-white/50' : 'w-1.5 h-1.5 bg-white/15'}`}
                />
              ))}
            </div>
          )}
          {hooks.length > 1 && (
            <>
              <button onClick={prev} className="p-1 hover:bg-white/10 rounded-lg transition-all">
                <ChevronLeft size={13} className="text-white/50 hover:text-white" />
              </button>
              <button onClick={next} className="p-1 hover:bg-white/10 rounded-lg transition-all">
                <ChevronRight size={13} className="text-white/50 hover:text-white" />
              </button>
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
            className="p-1 hover:bg-white/10 rounded-lg transition-all ml-0.5"
          >
            <X size={13} className="text-white/30 hover:text-white" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Category tile ─────────────────────────────────────────────────────────────
function CategoryTile({ cat, count }: {
  cat: typeof CATEGORIES[number]
  count: number | null
}) {
  const navigate = useNavigate()
  const Icon = cat.icon
  const hookText = getDailyHook(cat.hooks)

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/papers/${cat.type}`)}
      className={`flex-1 min-w-[140px] text-left rounded-xl border px-4 py-3.5 transition-all group ${cat.border} ${cat.bg}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className={cat.color} />
          <span className={`text-xs font-bold ${cat.color}`}>{cat.label}</span>
        </div>
        {count !== null && (
          <span className="text-[10px] text-muted shrink-0">{count.toLocaleString()} papers</span>
        )}
      </div>
      <p className="text-xs text-white/80 leading-relaxed line-clamp-2 group-hover:text-white transition-colors">
        {hookText}
      </p>
      <div className="flex items-center gap-1 mt-2 text-[10px] text-muted group-hover:text-white/60 transition-colors">
        View list <ArrowRight size={9} />
      </div>
    </motion.button>
  )
}

// ── Main FeedBanner ───────────────────────────────────────────────────────────
export function FeedBanner() {
  const [counts, setCounts] = useState<Record<string, number | null>>({
    trending: null, gems: null, new: null, rising: null,
  })

  useEffect(() => {
    // Load counts for each category tile from stats + quick counts
    Promise.allSettled([
      feedApi.getStats(),
    ]).then(([statsRes]) => {
      if (statsRes.status === 'fulfilled') {
        const s = statsRes.value.data
        setCounts((prev) => ({ ...prev, trending: s.trending_papers ?? null }))
      }
    })
  }, [])

  return (
    <div className="space-y-2.5">
      {/* Row 1: Auto-rotating daily paper hooks */}
      <HookRow />

      {/* Row 2: Category tiles */}
      <div className="flex gap-2 flex-wrap sm:flex-nowrap">
        {CATEGORIES.map((cat) => (
          <CategoryTile key={cat.type} cat={cat} count={cat.type === 'trending' ? counts.trending : null} />
        ))}
      </div>
    </div>
  )
}
