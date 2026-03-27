import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  alerts: Alert[]
}

function alertStyle(type: string) {
  switch (type) {
    case 'trending':    return 'alert-trending'
    case 'high_growth': return 'alert-rising'
    case 'new_papers':  return 'alert-new'
    case 'hidden_gems': return 'alert-hidden'
    default:            return 'alert-new'
  }
}

export function AlertBanner({ alerts }: Props) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [current, setCurrent] = useState(0)
  const navigate = useNavigate()

  const visible = alerts.map((a, i) => ({ ...a, _idx: i })).filter((a) => !dismissed.has(a._idx))
  if (!visible.length) return null

  const cur = visible[current % visible.length]

  const handleClick = () => {
    if (cur.type === 'new_papers') {
      navigate('/')
    } else if (cur.paper_id) {
      navigate(`/paper/${cur.paper_id}`)
    }
  }
  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setCurrent((c) => (c - 1 + visible.length) % visible.length) }
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setCurrent((c) => (c + 1) % visible.length) }
  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissed((d) => new Set([...d, cur._idx]))
    setCurrent((c) => Math.max(0, c - 1))
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${cur._idx}-${current}`}
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -14 }}
        transition={{ duration: 0.28 }}
        className={cn(
          'w-full rounded-xl px-4 py-3 border flex items-center gap-3 cursor-pointer',
          alertStyle(cur.type ?? '')
        )}
        onClick={handleClick}
      >
        <span className="text-xl shrink-0">{cur.emoji}</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-semibold leading-tight truncate">{cur.title}</p>
          {cur.message && cur.message !== cur.title && (
            <p className="text-xs text-slate-400/80 mt-0.5 truncate">{cur.message}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {visible.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 mr-1">
              {visible.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-full transition-all duration-300',
                    i === current % visible.length ? 'w-4 h-1.5 bg-white/55' : 'w-1.5 h-1.5 bg-white/20'
                  )}
                />
              ))}
            </div>
          )}

          {visible.length > 1 && (
            <>
              <button onClick={prev} className="p-1 hover:bg-white/10 rounded-lg transition-all">
                <ChevronLeft size={13} className="text-white/50 hover:text-white" />
              </button>
              <button onClick={next} className="p-1 hover:bg-white/10 rounded-lg transition-all">
                <ChevronRight size={13} className="text-white/50 hover:text-white" />
              </button>
            </>
          )}

          <button onClick={dismiss} className="p-1 hover:bg-white/10 rounded-lg transition-all ml-0.5">
            <X size={13} className="text-white/40 hover:text-white" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
