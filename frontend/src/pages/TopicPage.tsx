import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Loader2, ArrowRight, Users, Star,
  BookOpen, TrendingUp, Flame, Gem
} from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { landingApi } from '@/lib/api'
import { LandingPaper, TopicMeta } from '@/lib/types'
import { timeAgo, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'

const TOPIC_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  blue:    { bg: 'bg-blue-500/5',    border: 'border-blue-500/20',    text: 'text-blue-300',    accent: 'text-blue-400' },
  pink:    { bg: 'bg-pink-500/5',    border: 'border-pink-500/20',    text: 'text-pink-300',    accent: 'text-pink-400' },
  orange:  { bg: 'bg-orange-500/5',  border: 'border-orange-500/20',  text: 'text-orange-300',  accent: 'text-orange-400' },
  green:   { bg: 'bg-green-500/5',   border: 'border-green-500/20',   text: 'text-green-300',   accent: 'text-green-400' },
  red:     { bg: 'bg-red-500/5',     border: 'border-red-500/20',     text: 'text-red-300',     accent: 'text-red-400' },
  cyan:    { bg: 'bg-cyan-500/5',    border: 'border-cyan-500/20',    text: 'text-cyan-300',    accent: 'text-cyan-400' },
  yellow:  { bg: 'bg-yellow-500/5',  border: 'border-yellow-500/20',  text: 'text-yellow-300',  accent: 'text-yellow-400' },
  purple:  { bg: 'bg-purple-500/5',  border: 'border-purple-500/20',  text: 'text-purple-300',  accent: 'text-purple-400' },
  emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-300', accent: 'text-emerald-400' },
  slate:   { bg: 'bg-slate-500/5',   border: 'border-slate-500/20',   text: 'text-slate-300',   accent: 'text-slate-400' },
}

function TrendBadge({ label }: { label?: string }) {
  if (!label) return null
  if (label.includes('🔥') || label.toLowerCase().includes('trending')) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/20 font-medium flex items-center gap-1"><Flame size={8} /> Trending</span>
  }
  if (label.includes('📈') || label.toLowerCase().includes('rising')) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/20 font-medium flex items-center gap-1"><TrendingUp size={8} /> Rising</span>
  }
  if (label.includes('💎') || label.toLowerCase().includes('gem')) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20 font-medium flex items-center gap-1"><Gem size={8} /> Hidden Gem</span>
  }
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent-2/60 border border-accent/15 font-mono">{label}</span>
}

function PaperRow({ paper, index, onRead }: { paper: LandingPaper; index: number; onRead: () => void }) {
  const headline = paper.hook_text || paper.ai_lay_summary?.split('.')[0] || paper.title
  const whyImportant = paper.ai_why_important || paper.ai_summary
  const authors = paper.authors?.slice(0, 2).map(a => a.name).join(', ')
  const hf = paper.hf_upvotes || 0
  const hn = paper.hn_points || 0
  const stars = paper.github_stars || 0
  const cit = paper.citation_count || 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
      onClick={onRead}
      className="group cursor-pointer bg-surface border border-accent/12 rounded-2xl p-5 hover:border-accent/30 hover:bg-surface-2 transition-all"
    >
      <div className="flex items-start gap-4">
        {/* Rank number */}
        <span className="font-mono text-sm text-muted/40 w-6 shrink-0 mt-0.5">{index + 1}.</span>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <TrendBadge label={paper.trend_label} />
            {paper.ai_topic_tags?.slice(0, 2).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/8 text-accent-2/60 border border-accent/12">
                #{tag}
              </span>
            ))}
          </div>

          {/* Headline */}
          <h3 className="text-base font-bold text-white leading-snug group-hover:text-accent-2 transition-colors">
            {truncate(headline, 140)}
          </h3>

          {/* Subtitle — original title if hook was used */}
          {paper.hook_text && (
            <p className="text-[11px] text-slate-600 font-mono line-clamp-1">
              ↳ {truncate(paper.title, 90)}
            </p>
          )}

          {/* Why important */}
          {whyImportant && (
            <p className="text-sm text-muted leading-relaxed line-clamp-2">
              {truncate(whyImportant, 180)}
            </p>
          )}

          {/* Key findings preview */}
          {paper.ai_key_findings && paper.ai_key_findings.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {paper.ai_key_findings.slice(0, 2).map((f, i) => (
                <p key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                  <span className="text-accent/60 shrink-0 mt-px">✓</span>
                  {truncate(f, 90)}
                </p>
              ))}
            </div>
          )}

          {/* Bottom row: signals + meta */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {hf > 0 && <span className="text-xs text-orange-400/80">🤗 {hf.toLocaleString()}</span>}
            {hn > 0 && <span className="text-xs text-amber-400/80">🟠 {hn}</span>}
            {stars > 0 && (
              <span className="flex items-center gap-1 text-xs text-yellow-400/80">
                <Star size={10} className="fill-yellow-400" />
                {stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}
              </span>
            )}
            {cit > 0 && <span className="text-xs text-slate-400/80">📚 {cit}</span>}
            {authors && (
              <span className="flex items-center gap-1 text-xs text-muted/50">
                <Users size={10} /> {truncate(authors, 40)}
              </span>
            )}
            <span className="text-xs text-muted/40 ml-auto">{timeAgo(paper.published_at)}</span>
          </div>
        </div>

        {/* Read CTA */}
        <button
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent-2 text-xs font-medium rounded-lg transition-all"
          onClick={onRead}
        >
          <BookOpen size={11} /> Report
        </button>
      </div>
    </motion.div>
  )
}

export function TopicPage() {
  const { topic = 'General' } = useParams<{ topic: string }>()
  const navigate = useNavigate()

  const [papers, setPapers] = useState<LandingPaper[]>([])
  const [meta, setMeta] = useState<TopicMeta | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (pg: number, append = false) => {
    if (pg === 0) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await landingApi.getTopic(topic, pg)
      const d = res.data
      setPapers(prev => append ? [...prev, ...d.papers] : d.papers)
      setTotal(d.total)
      setHasMore(d.has_more)
      if (d.meta) setMeta(d.meta)
    } catch {
      // silent
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [topic])

  useEffect(() => {
    setPapers([])
    setPage(0)
    load(0)
  }, [topic, load])

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    load(next, true)
  }

  const colors = TOPIC_COLORS[meta?.color || 'slate']

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <div className={cn('border-b border-accent/10', meta ? colors.bg : '')}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors mb-5"
          >
            <ArrowLeft size={13} /> Back
          </button>

          {meta ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className={cn('inline-flex items-center gap-4 rounded-2xl px-5 py-4 border', colors.border, colors.bg)}
            >
              <span className="text-4xl">{meta.emoji}</span>
              <div>
                <h1 className={cn('text-2xl font-bold', colors.text)}>{meta.label}</h1>
                <p className="text-sm text-muted mt-0.5 max-w-lg">{meta.tagline}</p>
              </div>
            </motion.div>
          ) : (
            <h1 className="text-2xl font-bold text-white">{topic}</h1>
          )}

          {!loading && total > 0 && (
            <p className="text-xs text-muted mt-4">
              <span className="text-white font-semibold">{total.toLocaleString()}</span> papers in this category
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center py-24 gap-3 text-muted">
            <Loader2 size={28} className="animate-spin text-accent" />
            <p className="text-sm">Loading {topic} papers…</p>
          </div>
        ) : papers.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4 text-center">
            <span className="text-5xl">{meta?.emoji || '🔬'}</span>
            <p className="text-white font-semibold">No papers classified here yet</p>
            <p className="text-muted text-sm max-w-sm">
              Papers are being categorised as they're processed. Run the landing content
              generator from the admin panel to populate this topic.
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-xs text-accent hover:underline flex items-center gap-1"
            >
              <ArrowLeft size={11} /> Back to all topics
            </button>
          </div>
        ) : (
          <>
            {papers.map((paper, i) => (
              <PaperRow
                key={paper.id}
                paper={paper}
                index={i}
                onRead={() => navigate(`/report/${paper.id}`)}
              />
            ))}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-surface border border-accent/20 text-sm text-muted hover:text-white hover:border-accent/40 rounded-xl transition-all flex items-center gap-2"
                >
                  {loadingMore
                    ? <><Loader2 size={13} className="animate-spin" /> Loading…</>
                    : <><ArrowRight size={13} /> Load more</>}
                </button>
              </div>
            )}

            {!hasMore && papers.length > 0 && (
              <p className="text-center text-xs text-muted pt-6">
                All {total.toLocaleString()} papers in {meta?.label || topic} loaded
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
