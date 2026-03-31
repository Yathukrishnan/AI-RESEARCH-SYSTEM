/**
 * FeedBanner — rotating paper hook banner (individual papers only).
 * Category hooks are shown separately in CategoryAlerts (HomePage).
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { hooksApi } from '@/lib/api'
import { DailyHook } from '@/lib/types'

const ROTATE_MS = 6000

interface PaperItem extends DailyHook { kind: 'paper' }

function buildItems(papers: DailyHook[]): PaperItem[] {
  return papers.map(h => ({ ...h, kind: 'paper' as const }))
}

function paperStyle(label: string) {
  if (label.includes('Trending') || label.includes('🔥')) return 'border-orange-500/30 bg-orange-500/5'
  if (label.includes('Gems') || label.includes('💎'))    return 'border-purple-500/30 bg-purple-500/5'
  if (label.includes('Added') || label.includes('✨'))   return 'border-cyan-500/30 bg-cyan-500/5'
  if (label.includes('Rising') || label.includes('📈'))  return 'border-green-500/30 bg-green-500/5'
  return 'border-accent/25 bg-accent/5'
}

export function FeedBanner() {
  const [items, setItems]     = useState<PaperItem[]>([])
  const [current, setCurrent] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentRef = useRef(0)
  const itemsRef   = useRef<PaperItem[]>([])
  const navigate   = useNavigate()

  useEffect(() => {
    hooksApi.getToday()
      .then(r => {
        const list = buildItems(r.data?.hooks || [])
        setItems(list)
        itemsRef.current = list
      })
      .catch(() => {})
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
    if (item?.paper_id) navigate(`/paper/${item.paper_id}`)
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
  const style    = paperStyle(item.section_label)
  const emoji    = item.section_label.match(/^\p{Emoji}/u)?.[0] ?? '📄'
  const subtext  = item.section_label.replace(/^\p{Emoji}\s*/u, '')

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
          {item.hook_text}
        </p>
        <p className="text-[11px] text-slate-400/80 mt-0.5 line-clamp-1">
          {subtext}
        </p>
      </div>

      {/* Dots + prev/next/dismiss */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="hidden sm:flex items-center gap-1 mr-1">
          {items.map((_, i) => (
            <div key={i} className={`rounded-full transition-all duration-300 ${
              i === current ? 'w-4 h-1.5 bg-white/50' : 'w-1.5 h-1.5 bg-white/15'
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
