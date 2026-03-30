import { useRef } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, TrendingUp, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DashboardPaper } from '@/lib/types'
import { feedApi } from '@/lib/api'
import { timeAgo, dailyHook } from '@/lib/utils'

const HOOKS = [
  "Tearing through HuggingFace and HN this week",
  "The papers the community can't stop sharing right now",
  "Most upvoted, most discussed — community signal at full strength",
  "What practitioners are actually deploying and talking about",
  "Papers moving from arXiv to production in record time",
  "The AI community voted. These are the ones that matter",
  "Breakout research with real-world traction — swipe to explore",
]

interface Props { papers: DashboardPaper[]; hook?: string }

export function HypeCarousel({ papers, hook }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir === 'right' ? 280 : -280, behavior: 'smooth' })
  }

  const handleView = (paper: DashboardPaper) => {
    feedApi.interact(paper.id, 'view').catch(() => {})
    navigate(`/paper/${paper.id}`)
  }

  if (!papers.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1 }}
      className="bg-surface border border-yellow-500/15 rounded-2xl p-5 space-y-3"
      style={{ boxShadow: '0 0 24px rgba(234,179,8,0.07)' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp size={14} className="text-yellow-400" /> Breakout Architectures
          </h2>
          <p className="text-xs text-muted mt-0.5">{hook || dailyHook(HOOKS)}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => scroll('left')} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-white transition-all">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => scroll('right')} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-white transition-all">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {papers.map((paper, i) => (
          <div
            key={paper.id}
            onClick={() => handleView(paper)}
            className="flex-shrink-0 w-64 bg-surface-2 border border-yellow-500/15 rounded-xl p-4 cursor-pointer hover:border-yellow-500/35 transition-all group"
          >
            <div className="flex items-center gap-2 mb-2">
              {(paper.hf_upvotes || 0) > 0 && (
                <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full">
                  🤗 {paper.hf_upvotes}
                </span>
              )}
              {(paper.hn_points || 0) > 0 && (
                <span className="text-xs px-2 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full flex items-center gap-1">
                  <MessageCircle size={9} /> {paper.hn_points}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white leading-snug line-clamp-3 group-hover:text-yellow-300 transition-colors mb-2">
              {paper.hook_text || paper.title}
            </p>
            {paper.authors?.[0] && (
              <p className="text-xs text-muted truncate">{paper.authors[0].name}</p>
            )}
            <p className="text-xs text-slate-600 mt-1">{timeAgo(paper.published_at)}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
