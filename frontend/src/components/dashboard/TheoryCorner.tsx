import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { DashboardPaper } from '@/lib/types'
import { feedApi } from '@/lib/api'
import { timeAgo } from '@/lib/utils'

interface Props { papers: DashboardPaper[] }

export function TheoryCorner({ papers }: Props) {
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
      transition={{ duration: 0.45, delay: 0.35 }}
      className="bg-surface border border-slate-500/15 rounded-2xl p-5 space-y-4"
    >
      <div>
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen size={14} className="text-slate-400" /> Theory Desk
        </h2>
        <p className="text-xs text-muted mt-0.5">Mathematical bounds and pure science — no code required</p>
      </div>

      <div className="space-y-0 divide-y divide-accent/5">
        {papers.map((paper, i) => {
          const score = Math.round((paper.normalized_score || 0) * 100)
          return (
            <div
              key={paper.id}
              onClick={() => handleView(paper)}
              className="flex items-start gap-4 py-3 cursor-pointer group"
            >
              <span className="font-mono text-xs text-slate-600 w-5 shrink-0 mt-0.5 select-none">{String(i + 1).padStart(2, '0')}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 leading-snug line-clamp-2 group-hover:text-white transition-colors font-light tracking-tight">
                  {paper.title}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                  {paper.authors?.[0] && <span className="font-mono">{paper.authors[0].name}</span>}
                  {paper.primary_category && <span className="font-mono">[{paper.primary_category}]</span>}
                  <span>{timeAgo(paper.published_at)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono text-xs text-slate-500">{score}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
