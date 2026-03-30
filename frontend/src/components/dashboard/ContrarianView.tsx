import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import { DashboardPaper } from '@/lib/types'
import { feedApi } from '@/lib/api'
import { timeAgo, dailyHook } from '@/lib/utils'

const HOOKS = [
  "Research actively challenging dominant scaling paradigms",
  "Not cs.LG. Not cs.AI. The ideas coming from the edges of the field",
  "The papers asking whether the whole field is going the wrong direction",
  "Heterodox research with high scores — worth taking seriously",
  "Outside the mainstream. Inside the frontier",
  "When everyone zigs — these papers zag",
  "Contrarian bets that might be right — explore at your own risk",
]

interface Props { papers: DashboardPaper[] }

export function ContrarianView({ papers }: Props) {
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
      transition={{ duration: 0.45, delay: 0.4 }}
      className="bg-surface border border-orange-500/20 rounded-2xl p-5 space-y-4"
      style={{ boxShadow: '0 0 24px rgba(249,115,22,0.08)' }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
          <AlertTriangle size={14} className="text-orange-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">The Contrarian View</h2>
          <p className="text-xs text-muted mt-0.5">{dailyHook(HOOKS)}</p>
        </div>
      </div>

      <div className="space-y-2">
        {papers.map((paper) => {
          const score = Math.round((paper.normalized_score || 0) * 100)
          return (
            <div
              key={paper.id}
              onClick={() => handleView(paper)}
              className="flex items-start gap-3 p-3 bg-orange-500/4 border border-orange-500/12 rounded-xl cursor-pointer hover:border-orange-500/30 hover:bg-orange-500/8 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-orange-100 leading-snug line-clamp-2 group-hover:text-orange-300 transition-colors">
                  {paper.hook_text || paper.title}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-orange-800/70 flex-wrap">
                  {paper.authors?.[0] && <span>{paper.authors[0].name}</span>}
                  {paper.primary_category && (
                    <span className="px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded text-orange-500 font-mono text-[10px]">
                      {paper.primary_category}
                    </span>
                  )}
                  <span>{timeAgo(paper.published_at)}</span>
                  <span className="font-mono text-orange-400 ml-auto">{score}%</span>
                </div>
              </div>
              <ArrowUpRight size={13} className="text-orange-700 group-hover:text-orange-400 transition-colors shrink-0 mt-0.5" />
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
