import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ExternalLink, Github, Download, Bookmark, BookmarkCheck,
  Star, Quote, Eye, Users, Calendar, Tag, BarChart2, Cpu
} from 'lucide-react'
import { papersApi, feedApi } from '@/lib/api'
import { PaperDetail, ScoreHistoryItem, PaperCard as PaperCardType } from '@/lib/types'
import { Navbar } from '@/components/layout/Navbar'
import { TrendBadge } from '@/components/ui/TrendBadge'
import { ScoreBar } from '@/components/ui/ScoreBar'
import { PaperCard } from '@/components/feed/PaperCard'
import { getCategoryStyle, formatDate, fmtScore, isSaved, savePaper, unsavePaper } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { format } from 'date-fns'

export function PaperPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const similarRef = useRef<HTMLDivElement>(null)
  const [paper, setPaper] = useState<PaperDetail | null>(null)
  const [history, setHistory] = useState<ScoreHistoryItem[]>([])
  const [similar, setSimilar] = useState<PaperCardType[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!id) return
    const numId = parseInt(id)
    setSaved(isSaved(numId))
    setLoading(true)

    Promise.all([
      papersApi.getDetail(numId),
      papersApi.getScoreHistory(numId).catch(() => ({ data: [] })),
      papersApi.getSimilar(numId).catch(() => ({ data: { papers: [] } })),
    ]).then(([detailRes, histRes, simRes]) => {
      setPaper(detailRes.data)
      setHistory(histRes.data || [])
      setSimilar(simRes.data?.papers || [])
    }).catch(() => {
      toast.error('Failed to load paper')
      navigate('/')
    }).finally(() => setLoading(false))
  }, [id])

  // Scroll to #similar section when navigated from "Similar" button
  useEffect(() => {
    if (loading) return
    if (location.hash === '#similar' && similarRef.current) {
      setTimeout(() => similarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    }
  }, [loading, location.hash])

  const handleSave = () => {
    if (!paper) return
    if (saved) {
      unsavePaper(paper.id)
      setSaved(false)
      toast('Removed from saved', { icon: '📌' })
    } else {
      savePaper(paper.id)
      setSaved(true)
      feedApi.interact(paper.id, 'save').catch(() => {})
      toast.success('Saved!')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 rounded-xl shimmer bg-surface" />
          ))}
        </div>
      </div>
    )
  }

  if (!paper) return null

  const chartData = history.map((h) => ({
    date: format(new Date(h.scored_at), 'MMM d'),
    score: Math.round(h.scr_value * 100),
  }))

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>

        {/* Header card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface border border-accent/20 rounded-2xl p-6 space-y-5"
        >
          {/* Categories + badge */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap gap-2">
              {paper.categories.slice(0, 3).map((cat) => (
                <span key={cat} className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', getCategoryStyle(cat))}>
                  {cat}
                </span>
              ))}
            </div>
            {paper.trend_label && <TrendBadge label={paper.trend_label} size="md" />}
          </div>

          {/* Title */}
          <h1 className="text-xl font-bold text-white leading-snug">{paper.title}</h1>

          {/* Authors */}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Users size={14} className="text-muted shrink-0" />
            <span>{paper.authors.map((a) => a.name).join(', ')}</span>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
            {paper.published_at && (
              <span className="flex items-center gap-1.5">
                <Calendar size={12} /> {formatDate(paper.published_at)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Eye size={12} /> {paper.view_count} views
            </span>
            {paper.citation_count > 0 && (
              <span className="flex items-center gap-1.5">
                <Quote size={12} /> {paper.citation_count} citations
              </span>
            )}
            {paper.github_stars > 0 && (
              <span className="flex items-center gap-1.5">
                <Star size={12} /> {paper.github_stars} stars
              </span>
            )}
            <span className="ml-auto font-mono text-accent-2 font-bold text-sm">
              Score: {fmtScore(paper.normalized_score)}
            </span>
          </div>

          {/* Score bar */}
          <ScoreBar score={paper.normalized_score} label="Intelligence Score" />

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            {paper.pdf_url && (
              <a
                href={paper.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => feedApi.interact(paper.id, 'download').catch(() => {})}
                className="flex items-center gap-2 px-4 py-2 bg-highlight/10 border border-highlight/30 text-cyan-300 text-sm font-medium rounded-xl hover:bg-highlight/20 transition-all"
              >
                <Download size={14} /> Download PDF
              </a>
            )}
            {paper.html_url && (
              <a
                href={paper.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 text-accent-2 text-sm font-medium rounded-xl hover:bg-accent/20 transition-all"
              >
                <ExternalLink size={14} /> View on arXiv
              </a>
            )}
            {paper.github_url && (
              <a
                href={paper.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-accent/15 text-slate-300 text-sm font-medium rounded-xl hover:bg-surface-3 transition-all"
              >
                <Github size={14} /> GitHub
              </a>
            )}
            <button
              onClick={handleSave}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-all',
                saved
                  ? 'bg-warning/10 border-warning/30 text-yellow-400 hover:bg-warning/20'
                  : 'bg-surface-2 border-accent/15 text-muted hover:text-white hover:bg-surface-3'
              )}
            >
              {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </motion.div>

        {/* Abstract */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface border border-accent/15 rounded-2xl p-6 space-y-4"
        >
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Cpu size={15} className="text-accent-2" /> Abstract
          </h2>
          {paper.ai_summary && (
            <div className="p-3 bg-accent/5 border border-accent/15 rounded-xl">
              <p className="text-xs text-accent-2 font-medium mb-1">AI Summary</p>
              <p className="text-sm text-slate-300 leading-relaxed">{paper.ai_summary}</p>
            </div>
          )}
          <p className="text-sm text-slate-400 leading-relaxed">{paper.abstract}</p>
        </motion.div>

        {/* Tags */}
        {paper.ai_topic_tags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-surface border border-accent/15 rounded-2xl p-6 space-y-3"
          >
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Tag size={15} className="text-accent-2" /> Topic Tags
            </h2>
            <div className="flex flex-wrap gap-2">
              {paper.ai_topic_tags.map((tag) => (
                <span key={tag} className="text-sm px-3 py-1 bg-accent/10 text-accent-2 rounded-lg border border-accent/20">
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Score breakdown */}
        {paper.score_breakdown && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface border border-accent/15 rounded-2xl p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <BarChart2 size={15} className="text-accent-2" /> Score Breakdown
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ScoreBar score={paper.score_breakdown.ai_relevance} label="AI Relevance" />
              <ScoreBar score={paper.score_breakdown.ai_impact} label="AI Impact" />
              <ScoreBar score={paper.score_breakdown.keyword_score} label="Keyword Score" />
              <ScoreBar score={Math.min(1, paper.score_breakdown.citation_count / 100)} label="Citations" />
            </div>
          </motion.div>
        )}

        {/* Score history chart */}
        {chartData.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-surface border border-accent/15 rounded-2xl p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-white">Score History</h2>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#050d2e', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', color: '#e2e8f0' }}
                />
                <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Similar papers */}
        {similar.length > 0 && (
          <motion.div
            ref={similarRef}
            id="similar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4 scroll-mt-24"
          >
            <h2 className="text-base font-semibold text-white">Similar Papers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {similar.slice(0, 4).map((p, i) => (
                <PaperCard key={p.id} paper={p} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
