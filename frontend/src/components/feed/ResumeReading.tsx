import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { BookOpen, X, ArrowRight } from 'lucide-react'
import { getLastRead } from '@/lib/utils'
import { useState } from 'react'

export function ResumeReading() {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)
  const lastRead = getLastRead()

  if (!lastRead || dismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="bg-surface border border-accent/25 rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-accent/45 transition-all group"
      onClick={() => navigate(`/paper/${lastRead.id}`)}
    >
      <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 group-hover:bg-accent/25 transition-colors">
        <BookOpen size={14} className="text-accent-2" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted font-medium">Continue reading</p>
        <p className="text-sm text-white font-semibold truncate leading-tight">{lastRead.title}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden sm:flex items-center gap-1 text-xs text-accent-2 font-medium group-hover:gap-2 transition-all">
          Resume <ArrowRight size={12} />
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
          className="p-1 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={13} />
        </button>
      </div>
    </motion.div>
  )
}
