/**
 * FeedBanner — ONE unified rotating banner replacing both HookRotator + AlertBanner.
 *
 * Cycles through a merged list every 6 seconds:
 *   – Paper hooks from daily_hooks  → click opens paper detail
 *   – Category hooks (trending/gems/new/rising) → click opens category list page
 *
 * Category hooks are injected at regular intervals so users see them naturally
 * while browsing through paper headlines.
 */
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { hooksApi } from '@/lib/api'
import { DailyHook } from '@/lib/types'

const ROTATE_MS = 6000

// ── Category hook definitions ─────────────────────────────────────────────────
interface CategoryItem {
  kind: 'category'
  type: 'trending' | 'gems' | 'new' | 'rising'
  emoji: string
  section_label: string
  hook_text: string
  style: string
}

interface PaperItem extends DailyHook {
  kind: 'paper'
}

type BannerItem = CategoryItem | PaperItem

// Each category has several daily-rotating hooks
const CATEGORY_HOOKS: Record<string, { emoji: string; label: string; style: string; hooks: string[] }> = {
  trending: {
    emoji: '🔥',
    label: 'Trending Papers',
    style: 'border-orange-500/35 bg-orange-500/6',
    hooks: [
      "Top trending papers are here — see what the field is buzzing about!",
      "This week's highest-ranked papers in AI research",
      "The community has spoken — explore the top trending papers",
      "What researchers are reading and citing right now",
      "Hot papers climbing the rankings — don't miss them",
    ],
  },
  gems: {
    emoji: '💎',
    label: 'Hidden Gems',
    style: 'border-purple-500/35 bg-purple-500/6',
    hooks: [
      "Hidden gems this week — brilliant papers few have discovered yet",
      "High-impact research flying under the radar — explore now",
      "Before everyone else finds these — undiscovered gems inside",
      "Strong signal, low views — the overlooked papers worth reading",
      "Overlooked but exceptional — this week's hidden gems",
    ],
  },
  new: {
    emoji: '✨',
    label: 'New Papers',
    style: 'border-cyan-500/35 bg-cyan-500/6',
    hooks: [
      "Fresh papers just landed — new arXiv submissions, scored and ranked",
      "New this week — the latest AI research added to the feed",
      "Just added: this week's newest pre-prints and submissions",
      "Hot off the press — explore everything added in the last 7 days",
      "Latest AI & ML research, freshly ranked for you",
    ],
  },
  rising: {
    emoji: '📈',
    label: 'Rising Fast',
    style: 'border-green-500/35 bg-green-500/6',
    hooks: [
      "Papers rising fast — these are gaining momentum this week",
      "Rising stars in the rankings — papers to watch right now",
      "Scores accelerating: these papers are on the move",
      "Early movers gaining traction — get ahead of the trend",
      "These papers are climbing fast — see what's rising",
    ],
  },
}

// Pick daily hook text (rotates each calendar day)
function dailyCategoryHook(type: string): CategoryItem {
  const cat = CATEGORY_HOOKS[type]
  const dayIndex = Math.floor(Date.now() / 86_400_000)
  return {
    kind: 'category',
    type: type as CategoryItem['type'],
    emoji: cat.emoji,
    section_label: cat.label,
    hook_text: cat.hooks[dayIndex % cat.hooks.length],
    style: cat.style,
  }
}

// Build merged item list: inject a category hook every N paper hooks
function buildItems(paperHooks: DailyHook[]): BannerItem[] {
  const categories: CategoryItem['type'][] = ['trending', 'gems', 'new', 'rising']
  const papers: PaperItem[] = paperHooks.map((h) => ({ ...h, kind: 'paper' as const }))

  if (papers.length === 0) {
    // No paper hooks yet — show just category hooks
    return categories.map(dailyCategoryHook)
  }

  // Inject one category hook every 4 paper hooks
  const result: BannerItem[] = []
  let catIdx = 0
  for (let i = 0; i < papers.length; i++) {
    if (i % 4 === 0 && catIdx < categories.length) {
      result.push(dailyCategoryHook(categories[catIdx++]))
    }
    result.push(papers[i])
  }
  return result
}

// Style for paper hooks
function paperStyle(label: string) {
  if (label.includes('Trending')) return 'border-orange-500/30 bg-orange-500/5'
  if (label.includes('Gems'))     return 'border-purple-500/30 bg-purple-500/5'
  if (label.includes('Added'))    return 'border-cyan-500/30 bg-cyan-500/5'
  if (label.includes('Rising'))   return 'border-green-500/30 bg-green-500/5'
  return 'border-accent/25 bg-accent/5'
}

// ── Main component ────────────────────────────────────────────────────────────
export function FeedBanner() {
  const [items, setItems] = useState<BannerItem[]>([])
  const [current, setCurrent] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    hooksApi.getToday()
      .then((r) => {
        const hooks: DailyHook[] = r.data?.hooks || []
        setItems(buildItems(hooks))
      })
      .catch(() => {
        // Fallback: show only category hooks
        setItems((['trending', 'gems', 'new', 'rising'] as const).map(dailyCategoryHook))
      })
  }, [])

  useEffect(() => {
    if (items.length <= 1) return
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % items.length)
    }, ROTATE_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [items.length])

  if (!items.length || dismissed) return null

  const item = items[current]
  const isCategory = item.kind === 'category'
  const style = isCategory ? item.style : paperStyle(item.section_label)

  const handleClick = () => {
    if (isCategory) {
      navigate(`/papers/${item.type}`)
    } else if ((item as PaperItem).paper_id) {
      navigate(`/paper/${(item as PaperItem).paper_id}`)
    }
  }

  const go = (dir: 1 | -1, e: React.MouseEvent) => {
    e.stopPropagation()
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setCurrent((c) => (c + dir + items.length) % items.length)
    // Resume auto-rotate after manual nav
    timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % items.length), ROTATE_MS)
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        onClick={handleClick}
        className={`w-full rounded-xl px-4 py-3 border flex items-center gap-3 cursor-pointer group ${style}`}
      >
        {/* Label pill */}
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/8 text-white/80 whitespace-nowrap shrink-0 flex items-center gap-1">
          {item.section_label}
        </span>

        {/* Hook text */}
        <p className="flex-1 text-sm text-white font-semibold leading-tight line-clamp-1 group-hover:text-white/80 transition-colors">
          {item.hook_text}
        </p>

        {/* "View list" arrow for category items */}
        {isCategory && (
          <span className="hidden sm:flex items-center gap-1 text-[11px] text-white/40 group-hover:text-white/70 transition-colors shrink-0">
            View list <ArrowRight size={10} />
          </span>
        )}

        {/* Progress dots + nav */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="hidden sm:flex items-center gap-1 mr-1">
            {items.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-4 h-1.5 bg-white/50'
                    : items[i].kind === 'category'
                    ? 'w-2 h-1.5 bg-white/30'   // slightly larger dot for category items
                    : 'w-1.5 h-1.5 bg-white/15'
                }`}
              />
            ))}
          </div>

          <button onClick={(e) => go(-1, e)} className="p-1 hover:bg-white/10 rounded-lg transition-all">
            <ChevronLeft size={13} className="text-white/50 hover:text-white" />
          </button>
          <button onClick={(e) => go(1, e)} className="p-1 hover:bg-white/10 rounded-lg transition-all">
            <ChevronRight size={13} className="text-white/50 hover:text-white" />
          </button>
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
