import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Github, Bookmark, BookmarkCheck, Eye, Download,
  Users, Star, Quote, Layers, ArrowRight, Heart
} from 'lucide-react'
import { PaperCard as PaperCardType, FeedSection } from '@/lib/types'
import { TrendBadge } from '@/components/ui/TrendBadge'
import { getCategoryStyle, timeAgo, truncate, isSaved, savePaper, unsavePaper, setLastRead, getScoreColor } from '@/lib/utils'
import { feedApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type SectionType = FeedSection['section_type']

function cardClass(sectionType?: SectionType) {
  switch (sectionType) {
    case 'trending':    return 'paper-card-trending'
    case 'rising':      return 'paper-card-rising'
    case 'hidden_gems': return 'paper-card-hidden'
    case 'you_missed':  return 'paper-card-missed'
    default:            return ''
  }
}

function ScoreSegments({ score, sectionType }: { score: number; sectionType?: SectionType }) {
  const pct = Math.min(100, Math.round(score * 100))
  const filled = Math.round(pct / 10)
  const segmentColor = () => {
    switch (sectionType) {
      case 'trending':    return 'bg-orange-400'
      case 'rising':      return 'bg-green-400'
      case 'hidden_gems': return 'bg-purple-400'
      case 'you_missed':  return 'bg-amber-400'
      default: {
        if (pct >= 70) return 'bg-emerald-400'
        if (pct >= 40) return 'bg-yellow-400'
        return 'bg-accent/70'
      }
    }
  }
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={cn('h-1 flex-1 rounded-full transition-all duration-700', i < filled ? segmentColor() : 'bg-surface-3')}
        />
      ))}
      <span className={cn('text-xs font-mono font-bold ml-1.5 shrink-0', getScoreColor(score))}>
        {pct}%
      </span>
    </div>
  )
}

interface Props {
  paper: PaperCardType
  index?: number
  sectionType?: SectionType
}

export function PaperCard({ paper, index = 0, sectionType }: Props) {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(isSaved(paper.id))
  const [views, setViews] = useState(paper.view_count)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(paper.save_count ?? 0)

  const handleView = () => {
    feedApi.interact(paper.id, 'view').catch(() => {})
    setViews((v) => v + 1)
    setLastRead(paper.id, paper.title)
    navigate(`/paper/${paper.id}`)
  }

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (saved) {
      unsavePaper(paper.id)
      setSaved(false)
      toast('Removed from saved', { icon: '📌' })
    } else {
      savePaper(paper.id)
      setSaved(true)
      feedApi.interact(paper.id, 'save').catch(() => {})
      toast.success('Saved to reading list!')
    }
  }

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!liked) {
      setLiked(true)
      setLikeCount((c) => c + 1)
      toast('Marked as interesting!', { icon: '❤️' })
    }
  }

  const handlePdf = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!paper.pdf_url) return
    feedApi.interact(paper.id, 'download').catch(() => {})
    window.open(paper.pdf_url, '_blank')
  }

  const handleSimilar = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLastRead(paper.id, paper.title)
    navigate(`/paper/${paper.id}#similar`)
  }

  const isNew = paper.published_at
    ? (Date.now() - new Date(paper.published_at).getTime()) < 3 * 24 * 3600 * 1000
    : false

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.36), duration: 0.4 }}
      className={cn(
        'paper-card bg-surface border border-accent/15 rounded-2xl p-5 flex flex-col gap-3 cursor-pointer group',
        cardClass(sectionType)
      )}
      onClick={handleView}
    >
      {/* Row 1: categories + badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {paper.categories.slice(0, 2).map((cat) => (
            <span key={cat} className={cn('text-xs px-2 py-0.5 rounded-full border font-medium shrink-0', getCategoryStyle(cat))}>
              {cat}
            </span>
          ))}
          {isNew && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/12 text-cyan-300 border border-cyan-500/25 font-medium shrink-0 animate-bounce-in">
              ✦ New
            </span>
          )}
        </div>
        {paper.trend_label && (
          <div className="shrink-0">
            <TrendBadge label={paper.trend_label} />
          </div>
        )}
      </div>

      {/* Row 2: Hook (primary) or title fallback */}
      <div className="flex-1">
        {(paper as any).hook_text ? (
          <>
            <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-accent-2 transition-colors mb-1.5">
              {(paper as any).hook_text}
            </p>
            <p className="text-xs text-slate-500 leading-tight line-clamp-1 italic">
              {truncate(paper.title, 100)}
            </p>
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-accent-2 transition-colors mb-1.5">
              {paper.title}
            </h3>
            {paper.ai_summary ? (
              <div className="flex gap-1.5">
                <span className="text-accent-2 text-xs shrink-0 mt-px">💡</span>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {truncate(paper.ai_summary, 130)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {truncate(paper.abstract || '', 130)}
              </p>
            )}
          </>
        )}
      </div>

      {/* Row 4: Topic tags */}
      {paper.ai_topic_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {paper.ai_topic_tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-accent/8 text-accent-2/75 rounded-md border border-accent/15 hover:bg-accent/15 hover:text-accent-2 transition-colors"
            >
              #{tag}
            </span>
          ))}
          {paper.ai_topic_tags.length > 4 && (
            <span className="text-xs text-muted/60 self-center">+{paper.ai_topic_tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Row 5: Score segments */}
      <ScoreSegments score={paper.normalized_score} sectionType={sectionType} />

      {/* Row 6: Engagement stats */}
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Eye size={11} /> {views.toLocaleString()}
        </span>
        {paper.citation_count > 0 && (
          <span className="flex items-center gap-1">
            <Quote size={11} /> {paper.citation_count}
          </span>
        )}
        {paper.github_stars > 0 && (
          <span className="flex items-center gap-1 text-yellow-500/70">
            <Star size={11} />
            {paper.github_stars >= 1000 ? `${(paper.github_stars / 1000).toFixed(1)}k` : paper.github_stars}
          </span>
        )}
        {likeCount > 0 && (
          <span className={cn('flex items-center gap-1', liked && 'text-pink-400')}>
            <Heart size={11} className={liked ? 'fill-pink-400' : ''} /> {likeCount}
          </span>
        )}
        <span className="ml-auto shrink-0">{timeAgo(paper.published_at)}</span>
      </div>

      {/* Row 7: Authors */}
      <div className="flex items-center gap-1.5 text-xs text-muted/60">
        <Users size={10} className="shrink-0" />
        <span className="truncate">
          {paper.authors.slice(0, 2).map((a) => a.name).join(', ')}
          {paper.authors.length > 2 && <span> +{paper.authors.length - 2}</span>}
        </span>
      </div>

      {/* Row 8: Action buttons */}
      <div
        className="flex items-center gap-1.5 pt-2 border-t border-accent/10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleView}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 hover:border-accent/40 text-accent-2 text-xs font-medium rounded-lg transition-all"
        >
          <ArrowRight size={11} /> Details
        </button>

        {paper.pdf_url && (
          <button
            onClick={handlePdf}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-500/8 hover:bg-cyan-500/15 border border-cyan-500/20 text-cyan-300 text-xs font-medium rounded-lg transition-all"
          >
            <Download size={11} /> PDF
          </button>
        )}

        <button
          onClick={handleSimilar}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-2 hover:bg-surface-3 border border-accent/10 text-muted hover:text-white text-xs rounded-lg transition-all"
        >
          <Layers size={11} /> Similar
        </button>

        {paper.github_url && (
          <button
            onClick={(e) => { e.stopPropagation(); window.open(paper.github_url!, '_blank') }}
            className="p-1.5 bg-surface-2 hover:bg-surface-3 border border-accent/10 text-muted hover:text-white rounded-lg transition-all"
          >
            <Github size={11} />
          </button>
        )}

        <button
          onClick={handleLike}
          className={cn(
            'p-1.5 border rounded-lg transition-all',
            liked ? 'bg-pink-500/10 border-pink-500/30 text-pink-400' : 'bg-surface-2 border-accent/10 text-muted hover:text-pink-400 hover:border-pink-500/20'
          )}
        >
          <Heart size={11} className={liked ? 'fill-pink-400' : ''} />
        </button>

        <button
          onClick={handleSave}
          className={cn(
            'p-1.5 border rounded-lg transition-all ml-auto',
            saved ? 'bg-warning/10 border-warning/30 text-yellow-400' : 'bg-surface-2 border-accent/10 text-muted hover:text-yellow-400 hover:border-warning/20'
          )}
        >
          {saved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
        </button>
      </div>
    </motion.div>
  )
}
