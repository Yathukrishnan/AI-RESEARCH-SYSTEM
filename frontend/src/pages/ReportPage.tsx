import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Loader2, BookOpen, Download, Github,
  Users, Star, MessageSquare, ExternalLink,
  TrendingUp, Flame, Gem, Zap, CheckCircle2,
  ChevronRight, ArrowRight, Eye
} from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { landingApi, feedApi } from '@/lib/api'
import { ReportData, LandingPaper, SocialProof } from '@/lib/types'
import { timeAgo, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ── Topic colour map ─────────────────────────────────────────────────────────
const TOPIC_COLORS: Record<string, { bg: string; border: string; text: string; pill: string }> = {
  blue:    { bg: 'bg-blue-500/8',    border: 'border-blue-500/25',    text: 'text-blue-300',    pill: 'bg-blue-500/15 text-blue-300 border-blue-500/25' },
  pink:    { bg: 'bg-pink-500/8',    border: 'border-pink-500/25',    text: 'text-pink-300',    pill: 'bg-pink-500/15 text-pink-300 border-pink-500/25' },
  orange:  { bg: 'bg-orange-500/8',  border: 'border-orange-500/25',  text: 'text-orange-300',  pill: 'bg-orange-500/15 text-orange-300 border-orange-500/25' },
  green:   { bg: 'bg-green-500/8',   border: 'border-green-500/25',   text: 'text-green-300',   pill: 'bg-green-500/15 text-green-300 border-green-500/25' },
  red:     { bg: 'bg-red-500/8',     border: 'border-red-500/25',     text: 'text-red-300',     pill: 'bg-red-500/15 text-red-300 border-red-500/25' },
  cyan:    { bg: 'bg-cyan-500/8',    border: 'border-cyan-500/25',    text: 'text-cyan-300',    pill: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25' },
  yellow:  { bg: 'bg-yellow-500/8',  border: 'border-yellow-500/25',  text: 'text-yellow-300',  pill: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25' },
  purple:  { bg: 'bg-purple-500/8',  border: 'border-purple-500/25',  text: 'text-purple-300',  pill: 'bg-purple-500/15 text-purple-300 border-purple-500/25' },
  emerald: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/25', text: 'text-emerald-300', pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  slate:   { bg: 'bg-slate-500/8',   border: 'border-slate-500/25',   text: 'text-slate-300',   pill: 'bg-slate-500/15 text-slate-300 border-slate-500/25' },
}

// ── Social Proof Panel ────────────────────────────────────────────────────────
function SocialProofPanel({ proof }: { proof: SocialProof }) {
  const total = proof.hf_upvotes + proof.hn_points + proof.citation_count
  const isEmpty = total === 0 && proof.github_stars === 0

  return (
    <div className="rounded-2xl border border-accent/20 bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-accent/10 bg-accent/3">
        <p className="text-xs font-bold text-accent/70 uppercase tracking-widest">
          Why People Are Talking About This
        </p>
      </div>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* HuggingFace */}
        <div className={cn('flex flex-col items-center gap-1 p-3 rounded-xl border', proof.hf_upvotes > 0 ? 'bg-orange-500/8 border-orange-500/20' : 'bg-surface-2 border-accent/10 opacity-40')}>
          <span className="text-2xl">🤗</span>
          <span className="text-lg font-bold text-white">{proof.hf_upvotes > 0 ? proof.hf_upvotes.toLocaleString() : '—'}</span>
          <span className="text-[10px] text-muted text-center">HuggingFace upvotes</span>
        </div>

        {/* Hacker News */}
        <div className={cn('flex flex-col items-center gap-1 p-3 rounded-xl border', proof.hn_points > 0 ? 'bg-amber-500/8 border-amber-500/20' : 'bg-surface-2 border-accent/10 opacity-40')}>
          <span className="text-2xl">🟠</span>
          <div className="text-center">
            <span className="text-lg font-bold text-white">{proof.hn_points > 0 ? proof.hn_points : '—'}</span>
            {proof.hn_comments > 0 && <span className="text-[10px] text-muted block">{proof.hn_comments} comments</span>}
          </div>
          <span className="text-[10px] text-muted text-center">Hacker News points</span>
        </div>

        {/* Citations */}
        <div className={cn('flex flex-col items-center gap-1 p-3 rounded-xl border', proof.citation_count > 0 ? 'bg-blue-500/8 border-blue-500/20' : 'bg-surface-2 border-accent/10 opacity-40')}>
          <span className="text-2xl">📚</span>
          <span className="text-lg font-bold text-white">{proof.citation_count > 0 ? proof.citation_count : '—'}</span>
          <span className="text-[10px] text-muted text-center">Papers cite this</span>
        </div>

        {/* GitHub */}
        <div className={cn('flex flex-col items-center gap-1 p-3 rounded-xl border', proof.github_stars > 0 ? 'bg-yellow-500/8 border-yellow-500/20' : 'bg-surface-2 border-accent/10 opacity-40')}>
          <span className="text-2xl">⭐</span>
          <span className="text-lg font-bold text-white">
            {proof.github_stars > 0
              ? proof.github_stars >= 1000 ? `${(proof.github_stars / 1000).toFixed(1)}k` : proof.github_stars
              : '—'}
          </span>
          <span className="text-[10px] text-muted text-center">GitHub stars</span>
        </div>
      </div>

      {/* Interpretation */}
      {!isEmpty && (
        <div className="px-5 pb-4 text-xs text-muted leading-relaxed border-t border-accent/10 pt-3">
          {proof.hf_upvotes > 500 && (
            <p>🤗 <strong className="text-white">{proof.hf_upvotes.toLocaleString()} AI engineers</strong> bookmarked this on HuggingFace — that's a strong signal of practical importance in the AI community.</p>
          )}
          {proof.hn_points > 100 && (
            <p className="mt-1">🟠 <strong className="text-white">{proof.hn_points} points</strong> on Hacker News means thousands of software engineers read and upvoted this — rare for academic research.</p>
          )}
          {proof.citation_count > 20 && (
            <p className="mt-1">📚 <strong className="text-white">{proof.citation_count} other papers</strong> already cite this work — in academia, citations are the currency of influence.</p>
          )}
          {proof.github_stars > 200 && (
            <p className="mt-1">⭐ <strong className="text-white">{proof.github_stars.toLocaleString()} developers</strong> starred the code — this research ships working software, not just ideas.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Key Findings ──────────────────────────────────────────────────────────────
function KeyFindings({ findings }: { findings: string[] }) {
  if (!findings || findings.length === 0) return null
  return (
    <div className="rounded-2xl border border-accent/15 bg-surface p-5 space-y-3">
      <p className="text-xs font-bold text-accent/70 uppercase tracking-widest">Key Findings</p>
      <div className="space-y-2.5">
        {findings.map((f, i) => (
          <div key={i} className="flex items-start gap-3">
            <CheckCircle2 size={14} className="text-accent shrink-0 mt-0.5" />
            <p className="text-sm text-white/90 leading-snug">{f}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Trend Explanation ─────────────────────────────────────────────────────────
function TrendExplanation({ trendReason, trendLabel, whyImportant }: {
  trendReason: string
  trendLabel?: string
  whyImportant?: string
}) {
  const isGem = trendLabel?.includes('💎') || trendLabel?.toLowerCase().includes('gem')
  const isTrending = trendLabel?.includes('🔥') || trendLabel?.toLowerCase().includes('trending')
  const isRising = trendLabel?.includes('📈') || trendLabel?.toLowerCase().includes('rising')

  const icon = isGem ? <Gem size={16} className="text-purple-400" />
              : isTrending ? <Flame size={16} className="text-orange-400" />
              : isRising ? <TrendingUp size={16} className="text-green-400" />
              : <Zap size={16} className="text-cyan-400" />

  const borderColor = isGem ? 'border-purple-500/20'
                    : isTrending ? 'border-orange-500/20'
                    : isRising ? 'border-green-500/20'
                    : 'border-cyan-500/20'

  const bgColor = isGem ? 'bg-purple-500/5'
                : isTrending ? 'bg-orange-500/5'
                : isRising ? 'bg-green-500/5'
                : 'bg-cyan-500/5'

  return (
    <div className={cn('rounded-2xl border p-5 space-y-3', borderColor, bgColor)}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-bold uppercase tracking-widest text-muted">
          Why this is featured
        </p>
      </div>
      <p className="text-sm text-white/90 leading-relaxed">{trendReason}</p>
      {whyImportant && whyImportant !== trendReason && (
        <p className="text-sm text-muted leading-relaxed border-t border-white/5 pt-3">
          {whyImportant}
        </p>
      )}
    </div>
  )
}

// ── Related Papers ────────────────────────────────────────────────────────────
function RelatedPapers({ papers, onSelect }: { papers: LandingPaper[]; onSelect: (id: number) => void }) {
  if (!papers.length) return null
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-accent/70 uppercase tracking-widest">You Might Also Like</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {papers.map(p => {
          const headline = p.hook_text || p.ai_lay_summary?.split('.')[0] || p.title
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="group cursor-pointer bg-surface border border-accent/12 rounded-xl p-4 hover:border-accent/30 hover:bg-surface-2 transition-all"
            >
              <p className="text-sm font-semibold text-white line-clamp-2 group-hover:text-accent-2 transition-colors leading-snug mb-2">
                {truncate(headline, 100)}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted">{timeAgo(p.published_at)}</span>
                <ArrowRight size={12} className="text-muted group-hover:text-accent transition-colors" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    landingApi.getReport(Number(id))
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))

    // Track view
    feedApi.interact(Number(id), 'view').catch(() => {})
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center py-32 gap-3 text-muted">
          <Loader2 size={28} className="animate-spin text-accent" />
          <p className="text-sm">Loading report…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center py-32 gap-4 text-center">
          <p className="text-white font-semibold">Couldn't load this report</p>
          <button onClick={() => navigate(-1)} className="text-xs text-accent hover:underline flex items-center gap-1">
            <ArrowLeft size={11} /> Go back
          </button>
        </div>
      </div>
    )
  }

  const { paper, social_proof, trend_reason, related_papers, topic_meta } = data
  const colors = TOPIC_COLORS[topic_meta?.color || 'slate']
  const headline = paper.hook_text || paper.ai_lay_summary?.split('.')[0] || paper.title
  const authors = paper.authors?.slice(0, 3).map(a => a.name).join(', ')
  const topAuthorH = paper.authors?.find(a => a.h_index && a.h_index > 0)?.h_index

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Topic breadcrumb header */}
      <div className={cn('border-b border-accent/10', colors.bg)}>
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="flex items-center gap-2 text-xs text-muted">
            <button onClick={() => navigate('/')} className="hover:text-white transition-colors">Home</button>
            <ChevronRight size={11} />
            {topic_meta && (
              <>
                <button
                  onClick={() => navigate(`/explore/${paper.ai_topic_category}`)}
                  className={cn('hover:text-white transition-colors', colors.text)}
                >
                  {topic_meta.emoji} {topic_meta.label}
                </button>
                <ChevronRight size={11} />
              </>
            )}
            <span className="text-white/60 truncate max-w-xs">{truncate(paper.title, 50)}</span>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* ── Paper header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          {/* Category + trend badges */}
          <div className="flex flex-wrap items-center gap-2">
            {topic_meta && (
              <span className={cn('px-3 py-1 rounded-full text-xs font-bold border', colors.pill)}>
                {topic_meta.emoji} {topic_meta.label}
              </span>
            )}
            {paper.trend_label && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent-2 border border-accent/20">
                {paper.trend_label}
              </span>
            )}
            {paper.ai_topic_tags?.slice(0, 2).map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-accent/8 text-accent-2/60 border border-accent/12">
                #{tag}
              </span>
            ))}
          </div>

          {/* Big headline */}
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight">
            {headline}
          </h1>

          {/* Original paper title (if hook was used) */}
          {paper.hook_text && (
            <p className="text-sm text-slate-600 font-mono">
              ↳ {truncate(paper.title, 100)}
            </p>
          )}

          {/* Author + date */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
            {authors && (
              <span className="flex items-center gap-1.5">
                <Users size={12} />
                {authors}
                {paper.authors && paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
              </span>
            )}
            {topAuthorH && topAuthorH > 10 && (
              <span className="text-accent/70">h-index {Math.round(topAuthorH)}</span>
            )}
            <span>{timeAgo(paper.published_at)}</span>
            {paper.view_count > 0 && (
              <span className="flex items-center gap-1"><Eye size={11} /> {paper.view_count.toLocaleString()} views</span>
            )}
          </div>
        </motion.div>

        {/* ── Social proof ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
          <SocialProofPanel proof={social_proof} />
        </motion.div>

        {/* ── Why featured ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
          <TrendExplanation
            trendReason={trend_reason}
            trendLabel={paper.trend_label}
            whyImportant={paper.ai_why_important}
          />
        </motion.div>

        {/* ── What they did (lay summary) ── */}
        {paper.ai_lay_summary && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-3"
          >
            <p className="text-xs font-bold text-accent/70 uppercase tracking-widest">What They Did</p>
            <p className="text-base text-white/90 leading-relaxed">{paper.ai_lay_summary}</p>
          </motion.div>
        )}

        {/* ── Key findings ── */}
        {paper.ai_key_findings && paper.ai_key_findings.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
            <KeyFindings findings={paper.ai_key_findings} />
          </motion.div>
        )}

        {/* ── CTA: Read the paper ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="rounded-2xl border border-accent/20 bg-accent/5 p-6 space-y-4"
        >
          <div>
            <p className="text-xs font-bold text-accent/70 uppercase tracking-widest mb-1">Want to go deeper?</p>
            <p className="text-sm text-muted">This is a summary. The full research paper has all the technical details, experiments, and results.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {paper.pdf_url && (
              <a
                href={paper.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-background font-semibold text-sm rounded-xl hover:bg-accent/90 transition-all"
              >
                <Download size={14} /> Read Full Paper (PDF)
              </a>
            )}
            <button
              onClick={() => navigate(`/paper/${paper.id}`)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface border border-accent/20 text-muted hover:text-white text-sm rounded-xl transition-all"
            >
              <BookOpen size={14} /> Advanced Details
            </button>
            {paper.github_url && (
              <a
                href={paper.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface border border-accent/20 text-muted hover:text-white text-sm rounded-xl transition-all"
              >
                <Github size={14} /> View Code
              </a>
            )}
          </div>
        </motion.div>

        {/* ── Quality score info ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="rounded-xl border border-accent/10 bg-surface p-4 flex items-center gap-4"
        >
          <div className="flex flex-col items-center shrink-0">
            <span className="text-2xl font-bold text-white">{Math.round((paper.normalized_score || 0) * 100)}</span>
            <span className="text-[10px] text-muted uppercase tracking-wide">Quality Score</span>
          </div>
          <div className="flex-1 text-xs text-muted leading-relaxed">
            Our scoring system ranks this paper using citation count, GitHub activity, HuggingFace engagement,
            and AI-assessed relevance. A score above 70 means it's in the top tier of current AI research.
          </div>
        </motion.div>

        {/* ── Related papers ── */}
        {related_papers.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
            <RelatedPapers
              papers={related_papers}
              onSelect={newId => navigate(`/report/${newId}`)}
            />
          </motion.div>
        )}

        {/* Back nav */}
        <div className="flex items-center justify-between pt-4 border-t border-accent/10">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
          >
            <ArrowLeft size={13} /> Go back
          </button>
          {topic_meta && (
            <button
              onClick={() => navigate(`/explore/${paper.ai_topic_category}`)}
              className={cn('flex items-center gap-1.5 text-xs transition-colors', colors.text)}
            >
              More {topic_meta.label} papers <ChevronRight size={11} />
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
