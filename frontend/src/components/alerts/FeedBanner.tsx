/**
 * FeedBanner — unified rotating banner.
 * Two-line layout: bold hook + grey subtext nav hint.
 * Category items → /papers/:type. Paper items → /paper/:id.
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
  emoji: string
  hook: string
  subtext: string
  style: string
}
interface PaperItem extends DailyHook { kind: 'paper' }
type BannerItem = CategoryItem | PaperItem

const CATS: {
  type: CategoryItem['type']
  emoji: string
  style: string
  subtext: string
  hooks: string[]
}[] = [
  {
    type: 'trending',
    emoji: '🔥',
    style: 'border-orange-500/30 bg-orange-500/5',
    subtext: 'Top papers on the feed right now — tap to explore',
    hooks: [
      "Top trending papers are here — see what the field is reading",
      "The community's most-cited papers this week",
      "High-signal research climbing the rankings — explore now",
      "What researchers are reading and sharing right now",
      "This week's hottest AI papers — don't miss them",
    ],
  },
  {
    type: 'gems',
    emoji: '💎',
    style: 'border-purple-500/30 bg-purple-500/5',
    subtext: "High-impact work most haven't found yet — tap to explore",
    hooks: [
      "Hidden gems this week — brilliant papers few have discovered",
      "Strong signal, low views — overlooked papers worth reading",
      "Before everyone else finds these — undiscovered gems inside",
      "High-impact research flying under the radar",
      "Overlooked but exceptional — explore this week's hidden gems",
    ],
  },
  {
    type: 'new',
    emoji: '✨',
    style: 'border-cyan-500/30 bg-cyan-500/5',
    subtext: 'Fresh research just landed in the feed — tap to explore',
    hooks: [
      "New papers just landed — scored and ranked for you",
      "Latest arXiv submissions, fresh off the press",
      "Just added: this week's newest pre-prints",
      "Hot off the press — explore everything added this week",
      "New AI & ML research, freshly ranked",
    ],
  },
  {
    type: 'rising',
    emoji: '📈',
    style: 'border-green-500/30 bg-green-500/5',
    subtext: 'Papers gaining traction fast — tap to explore',
    hooks: [
      "Papers gaining momentum fast — see what's rising",
      "Rising stars in the rankings — papers to watch now",
      "These papers are climbing fast — explore the list",
      "Early movers gaining traction across the field",
      "Scores accelerating: papers on the move this week",
    ],
  },
]

function dailyCatItem(cat: typeof CATS[number]): CategoryItem {
  const day = Math.floor(Date.now() / 86_400_000)
  return {
    kind: 'category',
    type: cat.type,
    emoji: cat.emoji,
    hook: cat.hooks[day % cat.hooks.length],
    subtext: cat.subtext,
    style: cat.style,
  }
}

function buildItems(papers: DailyHook[]): BannerItem[] {
  const cats = CATS.map(dailyCatItem)
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
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
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
        const list = CATS.map(dailyCatItem)
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

  const item     = items[current]
  const isCat    = item.kind === 'category'
  const style    = isCat ? (item as CategoryItem).style : paperStyle((item as PaperItem).section_label)
  const emoji    = isCat ? (item as CategoryItem).emoji : (item as PaperItem).section_label.match(/^\p{Emoji}/u)?.[0] ?? '📄'
  const hookText = isCat ? (item as CategoryItem).hook : (item as PaperItem).hook_text
  const subtext  = isCat
    ? (item as CategoryItem).subtext
    : (item as PaperItem).section_label.replace(/^\p{Emoji}\s*/u, '')

  return (
    <motion.div
      key={current}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={handleClick}
      className={`w-full rounded-xl px-4 py-3 border flex items-center gap-3 cursor-pointer group ${style}`}
    >
      {/* Emoji */}
      <span className="text-xl shrink-0 select-none">{emoji}</span>

      {/* Two-line content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white leading-tight line-clamp-1 group-hover:text-white/90 transition-colors">
          {hookText}
        </p>
        <p className="text-[11px] text-slate-400/80 mt-0.5 flex items-center gap-1 line-clamp-1">
          {subtext}
          {isCat && <ArrowRight size={10} className="inline shrink-0 opacity-50" />}
        </p>
      </div>

      {/* Dots + prev/next/dismiss */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="hidden sm:flex items-center gap-1 mr-1">
          {items.map((it, i) => (
            <div key={i} className={`rounded-full transition-all duration-300 ${
              i === current           ? 'w-4 h-1.5 bg-white/50'
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
