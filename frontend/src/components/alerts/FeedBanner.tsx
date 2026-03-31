/**
 * FeedBanner — ONE unified rotating banner.
 * Cycles paper hooks + category hooks. Category items navigate to /papers/:type.
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { hooksApi } from '@/lib/api'
import { DailyHook } from '@/lib/types'

const ROTATE_MS = 6000

interface CategoryItem {
  kind: 'category'
  type: 'trending' | 'gems' | 'new' | 'rising'
  section_label: string
  hook_text: string
  style: string
}
interface PaperItem extends DailyHook { kind: 'paper' }
type BannerItem = CategoryItem | PaperItem

const CATEGORY_HOOKS: Record<string, {
  label: string; style: string; hooks: string[]
}> = {
  trending: {
    label: '🔥 Trending Papers',
    style: 'border-orange-500/35 bg-orange-500/6',
    hooks: [
      "Top trending papers are here — see what the field is buzzing about",
      "This week's highest-ranked AI papers — explore them",
      "The community has spoken — discover the top trending papers",
      "What researchers are reading and citing right now",
      "Hot papers climbing the rankings — tap to explore",
    ],
  },
  gems: {
    label: '💎 Hidden Gems',
    style: 'border-purple-500/35 bg-purple-500/6',
    hooks: [
      "Hidden gems this week — brilliant papers few have discovered yet",
      "High-impact research flying under the radar",
      "Before everyone else finds these — undiscovered gems inside",
      "Strong signal, low views — overlooked papers worth reading",
      "Overlooked but exceptional — explore this week's hidden gems",
    ],
  },
  new: {
    label: '✨ New Papers',
    style: 'border-cyan-500/35 bg-cyan-500/6',
    hooks: [
      "Fresh papers just landed — new arXiv submissions, scored and ranked",
      "New this week — the latest AI research added to the feed",
      "Just added: this week's newest pre-prints and submissions",
      "Hot off the press — explore everything added this week",
      "Latest AI & ML research, freshly ranked for you",
    ],
  },
  rising: {
    label: '📈 Rising Fast',
    style: 'border-green-500/35 bg-green-500/6',
    hooks: [
      "Papers gaining momentum fast — tap to see what's rising",
      "Rising stars in the rankings — papers to watch right now",
      "Scores accelerating: these papers are on the move",
      "Early movers gaining traction — get ahead of the trend",
      "These papers are climbing fast — explore the list",
    ],
  },
}

function dailyCategoryHook(type: string): CategoryItem {
  const cat = CATEGORY_HOOKS[type]
  const day = Math.floor(Date.now() / 86_400_000)
  return {
    kind: 'category',
    type: type as CategoryItem['type'],
    section_label: cat.label,
    hook_text: cat.hooks[day % cat.hooks.length],
    style: cat.style,
  }
}

function buildItems(papers: DailyHook[]): BannerItem[] {
  const cats = (['trending', 'gems', 'new', 'rising'] as const).map(dailyCategoryHook)
  if (!papers.length) return cats
  const result: BannerItem[] = []
  let ci = 0
  papers.forEach((h, i) => {
    if (i % 4 === 0 && ci < cats.length) result.push(cats[ci++])
    result.push({ ...h, kind: 'paper' as const })
  })
  return result
}

function paperStyle(label: string) {
  if (label.includes('Trending') || label.includes('🔥')) return 'border-orange-500/30 bg-orange-500/5'
  if (label.includes('Gems') || label.includes('💎'))    return 'border-purple-500/30 bg-purple-500/5'
  if (label.includes('Added') || label.includes('✨'))   return 'border-cyan-500/30 bg-cyan-500/5'
  if (label.includes('Rising') || label.includes('📈'))  return 'border-green-500/30 bg-green-500/5'
  return 'border-accent/25 bg-accent/5'
}

export function FeedBanner() {
  const [items, setItems]     = useState<BannerItem[]>([])
  const [current, setCurrent] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  // Store current index in a ref so click handlers always read latest value
  const currentRef = useRef(0)
  const itemsRef   = useRef<BannerItem[]>([])
  const navigate   = useNavigate()

  useEffect(() => {
    hooksApi.getToday()
      .then(r => {
        const list = buildItems(r.data?.hooks || [])
        setItems(list)
        itemsRef.current = list
      })
      .catch(() => {
        const list = (['trending', 'gems', 'new', 'rising'] as const).map(dailyCategoryHook)
        setItems(list)
        itemsRef.current = list
      })
  }, [])

  useEffect(() => { currentRef.current = current }, [current])
  useEffect(() => { itemsRef.current = items }, [items])

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % itemsRef.current.length)
    }, ROTATE_MS)
  }, [])

  useEffect(() => {
    if (items.length > 1) startTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [items.length, startTimer])

  // Read item from ref so click always uses latest state
  const handleClick = useCallback(() => {
    const item = itemsRef.current[currentRef.current]
    if (!item) return
    if (item.kind === 'category') {
      navigate(`/papers/${item.type}`)
    } else {
      const p = item as PaperItem
      if (p.paper_id) navigate(`/paper/${p.paper_id}`)
    }
  }, [navigate])

  const go = useCallback((dir: 1 | -1, e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrent(c => {
      const next = (c + dir + itemsRef.current.length) % itemsRef.current.length
      currentRef.current = next
      return next
    })
    startTimer()
  }, [startTimer])

  const dismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (timerRef.current) clearInterval(timerRef.current)
    setDismissed(true)
  }, [])

  if (!items.length || dismissed) return null

  const item      = items[current]
  const isCat     = item.kind === 'category'
  const style     = isCat ? (item as CategoryItem).style : paperStyle(item.section_label)
  const label     = item.section_label
  const hookText  = item.hook_text

  return (
    <motion.div
      key={current}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={handleClick}
      className={`w-full rounded-xl px-4 py-3 border flex items-center gap-3 cursor-pointer group ${style}`}
    >
      {/* Label */}
      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/8 text-white/80 whitespace-nowrap shrink-0">
        {label}
      </span>

      {/* Hook text */}
      <p className="flex-1 text-sm text-white font-semibold leading-tight line-clamp-1 group-hover:text-white/80 transition-colors">
        {hookText}
      </p>

      {/* "View list" hint for category items */}
      {isCat && (
        <span className="hidden sm:flex items-center gap-1 text-[11px] text-white/40 group-hover:text-white/70 transition-colors shrink-0 pointer-events-none">
          View list <ArrowRight size={10} />
        </span>
      )}

      {/* Dots + prev/next/dismiss */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="hidden sm:flex items-center gap-1 mr-1">
          {items.map((it, i) => (
            <div key={i} className={`rounded-full transition-all duration-300 ${
              i === current        ? 'w-4 h-1.5 bg-white/50'
              : it.kind === 'category' ? 'w-2 h-1.5 bg-white/30'
              : 'w-1.5 h-1.5 bg-white/15'
            }`} />
          ))}
        </div>
        <button onClick={e => go(-1, e)} className="p-1 hover:bg-white/10 rounded-lg transition-all">
          <ChevronLeft size={13} className="text-white/50" />
        </button>
        <button onClick={e => go(1, e)} className="p-1 hover:bg-white/10 rounded-lg transition-all">
          <ChevronRight size={13} className="text-white/50" />
        </button>
        <button onClick={dismiss} className="p-1 hover:bg-white/10 rounded-lg transition-all ml-0.5">
          <X size={13} className="text-white/30" />
        </button>
      </div>
    </motion.div>
  )
}
