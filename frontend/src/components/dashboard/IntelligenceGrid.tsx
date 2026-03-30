import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Clock, Zap } from 'lucide-react'
import { DashboardPaper } from '@/lib/types'
import { feedApi } from '@/lib/api'
import { timeAgo, dailyHook } from '@/lib/utils'

const HOOKS = [
  "The papers everyone in AI will be talking about tomorrow",
  "Freshest high-signal research — published and ranked in the last 72 hours",
  "Catch up fast: the most important papers since you last checked",
  "New this cycle — the papers making waves right now",
  "Critical research landing in the last 3 days, scored and ranked",
  "What just dropped that actually matters — today's top papers",
  "The field moved. Here's where it went in the last 72 hours",
]

interface Props { papers: DashboardPaper[] }

export function IntelligenceGrid({ papers }: Props) {
  const navigate = useNavigate()

  const handleView = (paper: DashboardPaper) => {
    feedApi.interact(paper.id, 'view').catch(() => {})
    navigate(`/paper/${paper.id}`)
  }

  if (!papers.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 }}
      className="bg-surface border border-cyan-500/15 rounded-2xl p-5 space-y-4"
      style={{ boxShadow: '0 0 24px rgba(6,182,212,0.07)' }}
    >
      <div>
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap size={14} className="text-cyan-400" /> Intelligence Grid
        </h2>
        <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
          <Clock size={10} /> {dailyHook(HOOKS)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {papers.slice(0, 6).map((paper, i) => {
          const isLarge = i === 0
          return (
            <div
              key={paper.id}
              onClick={() => handleView(paper)}
              className={`bg-surface-2 border border-cyan-500/10 rounded-xl p-4 cursor-pointer hover:border-cyan-500/30 transition-all group ${isLarge ? 'sm:col-span-2' : ''}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap gap-1">
                  {paper.primary_category && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded font-mono">
                      {paper.primary_category}
                    </span>
                  )}
                  {paper.ai_topic_tags?.slice(0, 2).map(t => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 bg-accent/8 text-accent-2/60 border border-accent/15 rounded">#{t}</span>
                  ))}
                </div>
                <span className="text-[10px] text-muted shrink-0">{timeAgo(paper.published_at)}</span>
              </div>
              <p className={`font-semibold text-white leading-snug group-hover:text-cyan-300 transition-colors line-clamp-2 ${isLarge ? 'text-base' : 'text-sm'}`}>
                {paper.hook_text || paper.title}
              </p>
              {isLarge && paper.ai_summary && (
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{paper.ai_summary}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                <span className="font-mono text-accent-2">{Math.round((paper.normalized_score || 0) * 100)}%</span>
                {paper.authors?.[0] && <span className="truncate">{paper.authors[0].name}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
