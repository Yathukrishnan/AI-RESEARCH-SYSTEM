import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Radio, ArrowUpRight } from 'lucide-react'
import { DashboardPaper } from '@/lib/types'
import { feedApi } from '@/lib/api'
import { timeAgo, dailyHook } from '@/lib/utils'

const HOOKS = [
  "Next-gen researchers the community is quietly upvoting",
  "Brilliant work from authors nobody's heard of — yet",
  "Low h-index, high impact — emerging voices worth following",
  "The next generation of AI researchers is publishing right now",
  "Researchers you've never heard of writing papers you need to read",
  "Not famous. Not hyped. Just quietly doing exceptional work",
  "Unknown authors, unmissable research — discover them first",
]

interface Props { papers: DashboardPaper[] }

export function UnderTheRadar({ papers }: Props) {
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
      transition={{ duration: 0.45, delay: 0.2 }}
      className="bg-surface border border-purple-500/15 rounded-2xl p-5 space-y-4"
      style={{ boxShadow: '0 0 24px rgba(168,85,247,0.07)' }}
    >
      <div>
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Radio size={14} className="text-purple-400" /> Under the Radar
        </h2>
        <p className="text-xs text-muted mt-0.5">{dailyHook(HOOKS)}</p>
      </div>

      <div className="space-y-2">
        {papers.map((paper, i) => {
          const hIndex = Math.round(paper.h_index_max || 0)
          const upvotes = paper.hf_upvotes || 0
          return (
            <div
              key={paper.id}
              onClick={() => handleView(paper)}
              className="flex items-start gap-3 p-3 bg-surface-2 border border-purple-500/10 rounded-xl cursor-pointer hover:border-purple-500/30 transition-all group"
            >
              <span className="text-xs font-bold text-slate-600 w-4 shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-purple-300 transition-colors">
                  {paper.hook_text || paper.title}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {paper.authors?.[0] && (
                    <span className="text-xs text-slate-400">{paper.authors[0].name}</span>
                  )}
                  {hIndex > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full">
                      h={hIndex}
                    </span>
                  )}
                  {upvotes > 0 && (
                    <span className="text-[10px] text-yellow-400">🤗 {upvotes}</span>
                  )}
                  <span className="text-[10px] text-muted">{timeAgo(paper.published_at)}</span>
                </div>
              </div>
              <ArrowUpRight size={13} className="text-muted group-hover:text-purple-400 transition-colors shrink-0 mt-0.5" />
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
