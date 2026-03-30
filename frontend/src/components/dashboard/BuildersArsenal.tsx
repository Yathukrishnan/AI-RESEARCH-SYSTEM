import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Github, Star, Terminal } from 'lucide-react'
import { DashboardPaper } from '@/lib/types'
import { feedApi } from '@/lib/api'

interface Props { papers: DashboardPaper[] }

export function BuildersArsenal({ papers }: Props) {
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
      transition={{ duration: 0.45, delay: 0.25 }}
      className="bg-surface border border-green-500/15 rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 0 24px rgba(34,197,94,0.07)' }}
    >
      {/* Terminal header bar */}
      <div className="flex items-center gap-2 px-5 py-3 bg-green-500/5 border-b border-green-500/10">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
        <div className="flex items-center gap-2 ml-2">
          <Terminal size={13} className="text-green-400" />
          <span className="text-xs font-mono text-green-400 font-bold">Builder's Arsenal</span>
        </div>
        <span className="text-xs font-mono text-slate-600 ml-auto">-- theory is good, code is better</span>
      </div>

      <div className="p-5 space-y-2">
        {papers.map((paper, i) => {
          const stars = paper.github_stars || 0
          const starsK = stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars.toString()
          return (
            <div
              key={paper.id}
              onClick={() => handleView(paper)}
              className="flex items-start gap-3 p-3 rounded-lg border border-green-500/8 bg-green-500/3 hover:border-green-500/25 hover:bg-green-500/6 cursor-pointer transition-all group"
            >
              <span className="font-mono text-xs text-green-600 w-4 shrink-0 mt-0.5">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-semibold text-green-100 leading-snug line-clamp-2 group-hover:text-green-300 transition-colors">
                  {paper.title}
                </p>
                {paper.authors?.[0] && (
                  <p className="text-xs font-mono text-green-700 mt-0.5"># {paper.authors[0].name}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="flex items-center gap-1 text-xs font-mono text-yellow-400 font-bold">
                  <Star size={10} className="fill-yellow-400" /> {starsK}
                </span>
                {paper.github_url && (
                  <a
                    href={paper.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted hover:text-green-400 transition-colors"
                  >
                    <Github size={12} />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
