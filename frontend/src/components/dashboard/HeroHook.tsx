import { motion } from 'framer-motion'
import { ArrowRight, Star, Quote, Award } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DashboardPaper } from '@/lib/types'
import { feedApi } from '@/lib/api'
import { timeAgo } from '@/lib/utils'

interface Props { paper: DashboardPaper }

export function HeroHook({ paper }: Props) {
  const navigate = useNavigate()

  const handleView = () => {
    feedApi.interact(paper.id, 'view').catch(() => {})
    navigate(`/paper/${paper.id}`)
  }

  const topAuthor = paper.authors?.[0]
  const hIndex = Math.round(paper.h_index_max || topAuthor?.h_index || 0)
  const score = Math.round((paper.normalized_score || 0) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onClick={handleView}
      className="relative overflow-hidden rounded-2xl border border-accent/30 cursor-pointer group"
      style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(14,165,233,0.06) 100%)', boxShadow: '0 0 40px rgba(99,102,241,0.15)' }}
    >
      {/* Glow orb */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative px-6 py-6 sm:px-8 sm:py-7">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-accent/20 border border-accent/30 text-accent-2 uppercase tracking-wider">
              Editor's Pick
            </span>
            {paper.primary_category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-accent/15 text-slate-400">
                {paper.primary_category}
              </span>
            )}
          </div>
          <span className="text-xs text-muted shrink-0">{timeAgo(paper.published_at)}</span>
        </div>

        {/* Author block */}
        {topAuthor && (
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/30 to-cyan-500/20 border border-accent/30 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-accent-2">{topAuthor.name?.[0] ?? '?'}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{topAuthor.name}</p>
              <div className="flex items-center gap-2">
                {hIndex > 0 && (
                  <span className="flex items-center gap-1 text-xs text-yellow-400">
                    <Award size={10} /> h-index {hIndex}
                  </span>
                )}
                {paper.authors.length > 1 && (
                  <span className="text-xs text-muted">+{paper.authors.length - 1} authors</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hook headline */}
        <div className="mb-5">
          {paper.hook_text ? (
            <>
              <p className="text-xl sm:text-2xl font-bold text-white leading-snug group-hover:text-accent-2 transition-colors mb-2">
                {paper.hook_text}
              </p>
              <p className="text-xs text-slate-500 font-mono line-clamp-1">↳ {paper.title}</p>
            </>
          ) : (
            <p className="text-xl sm:text-2xl font-bold text-white leading-snug group-hover:text-accent-2 transition-colors">
              {paper.title}
            </p>
          )}
          {paper.ai_summary && (
            <p className="text-sm text-slate-400 mt-2 leading-relaxed line-clamp-2">{paper.ai_summary}</p>
          )}
        </div>

        {/* Stats + CTA */}
        <div className="flex items-center gap-4 flex-wrap">
          {paper.citation_count > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Quote size={11} className="text-accent-2" /> {paper.citation_count} citations
            </span>
          )}
          {paper.github_stars > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-yellow-400">
              <Star size={11} /> {paper.github_stars.toLocaleString()} stars
            </span>
          )}
          <span className="text-xs text-slate-500 font-mono">score {score}%</span>

          <button className="ml-auto flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/80 group-hover:gap-3 transition-all">
            Read Paper <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
