import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { hooksApi } from '@/lib/api'
import { DailyHook } from '@/lib/types'

const ROTATE_MS = 6000

export function HookRotator() {
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

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrent((c) => (c - 1 + hooks.length) % hooks.length)
  }
  const next = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrent((c) => (c + 1) % hooks.length)
  }

  const handleClick = () => {
    if (hook.paper_id) navigate(`/paper/${hook.paper_id}`)
  }

  // Color per section_label
  const style = hook.section_label.includes('Trending')
    ? 'border-orange-500/30 bg-orange-500/5'
    : hook.section_label.includes('Gems')
    ? 'border-purple-500/30 bg-purple-500/5'
    : hook.section_label.includes('Added')
    ? 'border-cyan-500/30 bg-cyan-500/5'
    : hook.section_label.includes('Rising')
    ? 'border-green-500/30 bg-green-500/5'
    : 'border-accent/25 bg-accent/5'

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        onClick={handleClick}
        className={`w-full rounded-xl px-4 py-3 border flex items-center gap-3 cursor-pointer group ${style}`}
      >
        {/* Section label pill */}
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/8 text-white/80 whitespace-nowrap shrink-0">
          {hook.section_label}
        </span>

        {/* Hook text */}
        <p className="flex-1 text-sm text-white font-semibold leading-tight line-clamp-1 group-hover:text-white/90 transition-colors">
          {hook.hook_text}
        </p>

        {/* Controls */}
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
