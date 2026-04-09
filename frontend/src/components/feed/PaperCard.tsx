import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Github, Bookmark, BookmarkCheck, Eye,
  Download, Users, Star, Quote, Layers, ArrowRight, Heart
} from 'lucide-react'
import { PaperCard as PaperCardType, FeedSection } from '@/lib/types'
import { timeAgo, truncate, isSaved, savePaper, unsavePaper, setLastRead } from '@/lib/utils'
import { feedApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type SectionType = FeedSection['section_type']

function leftBorder(sectionType?: SectionType) {
  switch (sectionType) {
    case 'trending':    return 'border-l-orange-500'
    case 'rising':      return 'border-l-green-500'
    case 'hidden_gems': return 'border-l-purple-500'
    case 'you_missed':  return 'border-l-amber-400'
    default:            return 'border-l-white/15'
  }
}

function trendLabelStyle(label: string) {
  if (label.includes('Trending')) return 'text-orange-400'
  if (label.includes('Rising'))   return 'text-green-400'
  if (label.includes('Hidden'))   return 'text-purple-400'
  return 'text-amber-400'
}

function scoreColor(pct: number) {
  if (pct >= 75) return 'text-amber-400'
  if (pct >= 50) return 'text-white/80'
  return 'text-muted'
}

interface Props {
  paper: PaperCardType
  index?: number
  sectionType?: SectionType
}

export function PaperCard({ paper, index = 0, sectionType }: Props) {
  const navigate = useNavigate()
  const [saved, setSaved]       = useState(isSaved(paper.id))
  const [views, setViews]       = useState(paper.view_count)
  const [liked, setLiked]       = useState(false)
  const [likeCount, setLikeCount] = useState(paper.save_count ?? 0)

  const pct    = Math.min(100, Math.round(paper.normalized_score * 100))
  const isNew  = paper.published_at
    ? (Date.now() - new Date(paper.published_at).getTime()) < 3 * 24 * 3600 * 1000
    : false

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.32), duration: 0.35 }}
      className={cn(
        'paper-card bg-surface border border-white/8 border-l-[3px] p-5 flex flex-col gap-3 cursor-pointer group',
        leftBorder(sectionType)
      )}
      onClick={handleView}
    >
      {/* Row 1: categories + score */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="text-[10px] font-mono text-muted/70 uppercase tracking-wider leading-none">
            {paper.categories.slice(0, 2).join(' · ')}
          </span>
          {isNew && (
            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
              ✦ New
            </span>
          )}
          {paper.trend_label && (
            <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wider', trendLabelStyle(paper.trend_label))}>
              {paper.trend_label}
            </span>
          )}
          {(paper as any).hook_text && !paper.trend_label && (
            <span className="text-[10px] font-mono text-accent/50 uppercase tracking-wider">
              AI Pick
            </span>
          )}
        </div>
        {/* Score — large editorial number */}
        <div className="text-right shrink-0">
          <div className={cn('text-[22px] font-black leading-none tabular-nums font-mono', scoreColor(pct))}>
            {pct}
          </div>
          <div className="text-[9px] font-mono text-muted/50 uppercase tracking-[0.12em] mt-0.5">score</div>
        </div>
      </div>

      {/* Row 2: Hook / title */}
      <div className="flex-1">
        {(paper as any).hook_text ? (
          <>
            <p className="text-[15px] font-bold text-white leading-snug line-clamp-2 group-hover:text-amber-50 transition-colors tracking-tight">
              {(paper as any).hook_text}
            </p>
            <p className="text-[10px] text-muted/45 font-mono mt-1.5 line-clamp-1 leading-tight">
              ↳ {truncate(paper.title, 90)}
            </p>
          </>
        ) : paper.ai_summary ? (
          <>
            <p className="text-[15px] font-bold text-white leading-snug line-clamp-2 group-hover:text-amber-50 transition-colors tracking-tight">
              {truncate(paper.ai_summary, 160)}
            </p>
            <p className="text-[10px] text-muted/45 font-mono mt-1.5 line-clamp-1 leading-tight">
              ↳ {truncate(paper.title, 90)}
            </p>
          </>
        ) : (
          <>
            <h3 className="text-[15px] font-bold text-white leading-snug line-clamp-2 group-hover:text-amber-50 transition-colors tracking-tight">
              {paper.title}
            </h3>
            {paper.abstract && (
              <p className="text-[11px] text-muted/60 leading-relaxed line-clamp-2 mt-1">
                {truncate(paper.abstract, 130)}
              </p>
            )}
          </>
        )}
      </div>

      {/* Row 3: Topic tags — monospace, no backgrounds */}
      {paper.ai_topic_tags.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {paper.ai_topic_tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[10px] font-mono text-accent/45 hover:text-accent/70 transition-colors">
              #{tag}
            </span>
          ))}
          {paper.ai_topic_tags.length > 4 && (
            <span className="text-[10px] font-mono text-muted/40">+{paper.ai_topic_tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Row 4: Engagement stats — monospace */}
      <div className="flex items-center gap-3 text-[11px] font-mono text-muted/60">
        <span className="flex items-center gap-1">
          <Eye size={10} /> {views.toLocaleString()}
        </span>
        {paper.citation_count > 0 && (
          <span className="flex items-center gap-1">
            <Quote size={10} /> {paper.citation_count}
          </span>
        )}
        {paper.github_stars > 0 && (
          <span className="flex items-center gap-1 text-yellow-500/55">
            <Star size={10} />
            {paper.github_stars >= 1000 ? `${(paper.github_stars / 1000).toFixed(1)}k` : paper.github_stars}
          </span>
        )}
        {likeCount > 0 && (
          <span className={cn('flex items-center gap-1', liked ? 'text-rose-400' : '')}>
            <Heart size={10} className={liked ? 'fill-rose-400' : ''} /> {likeCount}
          </span>
        )}
        <span className="ml-auto text-muted/40">{timeAgo(paper.published_at)}</span>
      </div>

      {/* Row 5: Authors — small caps */}
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted/35 uppercase tracking-wide truncate">
        <Users size={9} className="shrink-0 opacity-60" />
        <span className="truncate">
          {paper.authors.slice(0, 3).map((a) => a.name).join(' · ')}
          {paper.authors.length > 3 && <span> +{paper.authors.length - 3}</span>}
        </span>
      </div>

      {/* Row 6: Action bar — flat text links */}
      <div
        className="flex items-center gap-0 pt-2.5 border-t border-white/6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleView}
          className="flex items-center gap-1 text-[12px] font-medium text-white/65 hover:text-accent transition-colors pr-3"
        >
          Details <ArrowRight size={11} />
        </button>

        {paper.pdf_url && (
          <button
            onClick={handlePdf}
            className="flex items-center gap-1 text-[12px] font-mono text-muted/50 hover:text-white transition-colors px-3 border-l border-white/8"
          >
            <Download size={10} /> PDF
          </button>
        )}

        <button
          onClick={handleSimilar}
          className="flex items-center gap-1 text-[12px] font-mono text-muted/50 hover:text-white transition-colors px-3 border-l border-white/8"
        >
          <Layers size={10} /> Similar
        </button>

        {paper.github_url && (
          <button
            onClick={(e) => { e.stopPropagation(); window.open(paper.github_url!, '_blank') }}
            className="text-muted/40 hover:text-white transition-colors px-3 border-l border-white/8"
          >
            <Github size={11} />
          </button>
        )}

        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={handleLike}
            className={cn('transition-colors', liked ? 'text-rose-400' : 'text-muted/35 hover:text-rose-400')}
          >
            <Heart size={12} className={liked ? 'fill-rose-400' : ''} />
          </button>
          <button
            onClick={handleSave}
            className={cn('transition-colors', saved ? 'text-amber-400' : 'text-muted/35 hover:text-amber-400')}
          >
            {saved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
