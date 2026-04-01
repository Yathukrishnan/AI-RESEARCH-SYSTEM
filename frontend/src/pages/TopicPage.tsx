/**
 * TopicPage — the middle layer between landing and report.
 *
 * Shows all papers in a topic as:
 *   1. A journalist-style hook sentence (one for each paper)
 *   2. A 2-line plain-English abstract beneath it
 *   3. Subtle community signal (🤗 / 🟠 only if non-zero)
 *
 * Zero paper titles, zero scores, zero metadata.
 * Every click goes to /report/:id.
 *
 * Flow:  /explore/:topic  →  /report/:id  →  source paper
 */
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, ArrowRight } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { landingApi } from '@/lib/api'
import { LandingPaper, TopicMeta } from '@/lib/types'
import { truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'

const COLORS: Record<string, { bg: string; border: string; text: string; accent: string; hookHover: string }> = {
  blue:    { bg: 'bg-blue-500/5',    border: 'border-blue-500/20',    text: 'text-blue-300',    accent: 'bg-blue-500/15 border-blue-500/25 text-blue-300',    hookHover: 'hover:text-blue-100' },
  pink:    { bg: 'bg-pink-500/5',    border: 'border-pink-500/20',    text: 'text-pink-300',    accent: 'bg-pink-500/15 border-pink-500/25 text-pink-300',    hookHover: 'hover:text-pink-100' },
  orange:  { bg: 'bg-orange-500/5',  border: 'border-orange-500/20',  text: 'text-orange-300',  accent: 'bg-orange-500/15 border-orange-500/25 text-orange-300',  hookHover: 'hover:text-orange-100' },
  green:   { bg: 'bg-green-500/5',   border: 'border-green-500/20',   text: 'text-green-300',   accent: 'bg-green-500/15 border-green-500/25 text-green-300',   hookHover: 'hover:text-green-100' },
  red:     { bg: 'bg-red-500/5',     border: 'border-red-500/20',     text: 'text-red-300',     accent: 'bg-red-500/15 border-red-500/25 text-red-300',     hookHover: 'hover:text-red-100' },
  cyan:    { bg: 'bg-cyan-500/5',    border: 'border-cyan-500/20',    text: 'text-cyan-300',    accent: 'bg-cyan-500/15 border-cyan-500/25 text-cyan-300',    hookHover: 'hover:text-cyan-100' },
  yellow:  { bg: 'bg-yellow-500/5',  border: 'border-yellow-500/20',  text: 'text-yellow-300',  accent: 'bg-yellow-500/15 border-yellow-500/25 text-yellow-300',  hookHover: 'hover:text-yellow-100' },
  purple:  { bg: 'bg-purple-500/5',  border: 'border-purple-500/20',  text: 'text-purple-300',  accent: 'bg-purple-500/15 border-purple-500/25 text-purple-300',  hookHover: 'hover:text-purple-100' },
  emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-300', accent: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300', hookHover: 'hover:text-emerald-100' },
  slate:   { bg: 'bg-slate-500/5',   border: 'border-slate-500/20',   text: 'text-slate-300',   accent: 'bg-slate-500/15 border-slate-500/25 text-slate-300',   hookHover: 'hover:text-slate-100' },
}

function getPaperHook(p: LandingPaper): string {
  // Priority: AI journalist hook → existing hook_text → first sentence of lay summary → title
  return (p as any).ai_journalist_hook
    || p.hook_text
    || p.ai_lay_summary?.split('.')[0]
    || p.title
}

function getSummary(p: LandingPaper): string {
  // Show lay summary if available, otherwise ai_summary, otherwise first 200 chars of abstract
  if (p.ai_lay_summary) return p.ai_lay_summary
  if (p.ai_summary) return p.ai_summary
  return p.abstract ? truncate(p.abstract, 200) : ''
}

// ── A single story card ───────────────────────────────────────────────────────
function StoryCard({ paper, index, color, onRead }: {
  paper: LandingPaper
  index: number
  color: string
  onRead: () => void
}) {
  const c = COLORS[color] || COLORS.slate
  const hook = getPaperHook(paper)
  const summary = getSummary(paper)
  const hf = paper.hf_upvotes || 0
  const hn = paper.hn_points || 0

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.45), duration: 0.35 }}
      onClick={onRead}
      className="group cursor-pointer border-b border-white/5 last:border-0 py-7 first:pt-2"
    >
      <div className="flex gap-5 items-start">
        {/* Story number */}
        <span className="font-mono text-sm text-muted/25 w-5 shrink-0 mt-1">{index + 1}</span>

        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Trend indicator if paper is hot */}
          {(hf > 100 || hn > 50) && (
            <div className="flex items-center gap-2">
              {hf > 100 && (
                <span className="text-[10px] text-orange-400/70">
                  🤗 {hf > 999 ? `${(hf/1000).toFixed(1)}k` : hf} engineers discussing
                </span>
              )}
              {hn > 50 && (
                <span className="text-[10px] text-amber-400/70">
                  🟠 {hn} on Hacker News
                </span>
              )}
            </div>
          )}

          {/* THE HOOK — the main story sentence */}
          <h3 className={cn(
            'text-lg md:text-xl font-bold leading-snug transition-colors',
            c.hookHover, 'text-white/90'
          )}>
            {hook}
          </h3>

          {/* 2-line summary — plain English, no jargon */}
          {summary && (
            <p className="text-sm text-muted/70 leading-relaxed line-clamp-2">
              {truncate(summary, 220)}
            </p>
          )}

          {/* Read link */}
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-semibold transition-colors',
            c.text, 'opacity-60 group-hover:opacity-100'
          )}>
            Read the full report <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </motion.article>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function TopicPage() {
  const { topic = 'General' } = useParams<{ topic: string }>()
  const navigate = useNavigate()

  const [papers, setPapers] = useState<LandingPaper[]>([])
  const [meta, setMeta] = useState<TopicMeta | null>(null)
  const [topicHook, setTopicHook] = useState('')
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
      if (d.meta) {
        setMeta(d.meta)
        setTopicHook((d.meta as any).hook || d.meta.tagline || '')
      }
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

  const color = meta?.color || 'slate'
  const c = COLORS[color] || COLORS.slate

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Topic header ── */}
      <div className={cn('border-b border-accent/10', c.bg)}>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
          {/* Back */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
          >
            <ArrowLeft size={12} /> All topics
          </button>

          {meta ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-3"
            >
              {/* Label */}
              <div className="flex items-center gap-3">
                <span className={cn('w-12 h-12 rounded-xl border flex items-center justify-center text-2xl shrink-0', c.accent)}>
                  {meta.emoji}
                </span>
                <div>
                  <h1 className={cn('text-2xl font-extrabold', c.text)}>{meta.label}</h1>
                  {total > 0 && (
                    <p className="text-xs text-muted/60 mt-0.5">{total.toLocaleString()} papers this week</p>
                  )}
                </div>
              </div>

              {/* The journalist narrative hook for this topic */}
              {topicHook && (
                <p className={cn('text-base md:text-lg font-medium leading-relaxed', c.text, 'opacity-80')}>
                  {topicHook}
                </p>
              )}
            </motion.div>
          ) : (
            <h1 className="text-2xl font-bold text-white">{topic}</h1>
          )}
        </div>
      </div>

      {/* ── Story list ── */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center py-24 gap-3 text-muted">
            <Loader2 size={26} className="animate-spin text-accent" />
            <p className="text-sm">Finding the stories…</p>
          </div>
        ) : papers.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4 text-center">
            <span className="text-5xl">{meta?.emoji || '🔬'}</span>
            <p className="text-white font-semibold">No stories yet in {meta?.label || topic}</p>
            <p className="text-muted text-sm max-w-sm">
              Papers are being classified. Run the landing content generator
              in the admin panel to populate this topic.
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
            <div className="divide-y divide-white/0">
              {papers.map((p, i) => (
                <StoryCard
                  key={p.id}
                  paper={p}
                  index={i}
                  color={color}
                  onRead={() => navigate(`/report/${p.id}`)}
                />
              ))}
            </div>

            {/* Pagination */}
            {hasMore && (
              <div className="flex justify-center py-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-7 py-3 bg-surface border border-accent/20 text-sm text-muted hover:text-white hover:border-accent/40 rounded-xl transition-all flex items-center gap-2"
                >
                  {loadingMore
                    ? <><Loader2 size={13} className="animate-spin" /> Loading more…</>
                    : <>Load more stories <ArrowRight size={13} /></>}
                </button>
              </div>
            )}

            {!hasMore && papers.length > 0 && (
              <p className="text-center text-xs text-muted py-8">
                You've read all {total.toLocaleString()} stories in {meta?.label || topic}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
