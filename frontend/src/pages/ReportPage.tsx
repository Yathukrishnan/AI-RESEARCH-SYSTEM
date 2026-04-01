/**
 * ReportPage — the digest layer between the topic page and the source paper.
 *
 * Shows:
 *   - Rich journalist narrative as the opening (never the paper title)
 *   - Plain English abstract / lay summary
 *   - Full credibility panel: 8 score cards each explained in plain English
 *   - Why this is featured
 *   - Key findings
 *   - CTA to read the full paper
 *   - Related stories
 *
 * No paper title shown anywhere.
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Loader2, Download, Github,
  Flame, Gem, Zap, TrendingUp,
  CheckCircle2, ChevronRight, ArrowRight, BookOpen
} from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { landingApi, feedApi } from '@/lib/api'
import { ReportData, LandingPaper, SocialProof } from '@/lib/types'
import { timeAgo, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ── Colour map ─────────────────────────────────────────────────────────────────
const TC: Record<string, { bg: string; border: string; text: string; pill: string }> = {
  blue:    { bg: 'bg-blue-500/6',    border: 'border-blue-500/20',    text: 'text-blue-300',    pill: 'bg-blue-500/15 text-blue-300 border-blue-500/25' },
  pink:    { bg: 'bg-pink-500/6',    border: 'border-pink-500/20',    text: 'text-pink-300',    pill: 'bg-pink-500/15 text-pink-300 border-pink-500/25' },
  orange:  { bg: 'bg-orange-500/6',  border: 'border-orange-500/20',  text: 'text-orange-300',  pill: 'bg-orange-500/15 text-orange-300 border-orange-500/25' },
  green:   { bg: 'bg-green-500/6',   border: 'border-green-500/20',   text: 'text-green-300',   pill: 'bg-green-500/15 text-green-300 border-green-500/25' },
  red:     { bg: 'bg-red-500/6',     border: 'border-red-500/20',     text: 'text-red-300',     pill: 'bg-red-500/15 text-red-300 border-red-500/25' },
  cyan:    { bg: 'bg-cyan-500/6',    border: 'border-cyan-500/20',    text: 'text-cyan-300',    pill: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25' },
  yellow:  { bg: 'bg-yellow-500/6',  border: 'border-yellow-500/20',  text: 'text-yellow-300',  pill: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25' },
  purple:  { bg: 'bg-purple-500/6',  border: 'border-purple-500/20',  text: 'text-purple-300',  pill: 'bg-purple-500/15 text-purple-300 border-purple-500/25' },
  emerald: { bg: 'bg-emerald-500/6', border: 'border-emerald-500/20', text: 'text-emerald-300', pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  slate:   { bg: 'bg-slate-500/6',   border: 'border-slate-500/20',   text: 'text-slate-300',   pill: 'bg-slate-500/15 text-slate-300 border-slate-500/25' },
}

function getHook(p: LandingPaper): string {
  return (p as any).ai_journalist_hook || p.hook_text || p.ai_lay_summary?.split('.')[0] || p.title
}

// ── Single score card ──────────────────────────────────────────────────────────
interface ScoreCardProps {
  icon: string
  value: string
  label: string
  sublabel: string
  active: boolean
  highlight?: string
}

function ScoreCard({ icon, value, label, sublabel, active, highlight }: ScoreCardProps) {
  return (
    <div className={cn(
      'flex flex-col gap-2.5 p-4 rounded-2xl border transition-all',
      active
        ? highlight || 'bg-surface border-accent/20'
        : 'bg-surface/40 border-white/5 opacity-40'
    )}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl leading-none mt-0.5">{icon}</span>
        <span className={cn(
          'text-lg font-extrabold tabular-nums leading-tight text-right',
          active ? 'text-white' : 'text-muted/40'
        )}>
          {value}
        </span>
      </div>
      <div className="space-y-0.5">
        <p className={cn('text-xs font-bold leading-tight', active ? 'text-white/85' : 'text-muted/35')}>
          {label}
        </p>
        <p className="text-[11px] text-muted/50 leading-snug">{sublabel}</p>
      </div>
    </div>
  )
}

// ── Credibility Panel (all 8 scores) ───────────────────────────────────────────
function CredibilityPanel({ paper, proof }: { paper: LandingPaper; proof: SocialProof }) {
  const hf       = proof.hf_upvotes || 0
  const hn       = proof.hn_points || 0
  const hnC      = proof.hn_comments || 0
  const cit      = proof.citation_count || 0
  const infCit   = proof.influential_citation_count || 0
  const stars    = proof.github_stars || 0
  const hIdx     = proof.h_index || paper.h_index_max || 0
  const citVel   = proof.citation_velocity || paper.citation_velocity || 0
  const quality  = proof.quality_score || Math.round((paper.normalized_score || 0) * 100)

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
  const hnVal = hn > 0 ? (hnC > 0 ? `${hn} pts\n${hnC} cmts` : `${hn} pts`) : '—'
  const velVal = citVel > 0 ? `+${(citVel * 100).toFixed(0)}%/yr` : '—'

  // Which signals are genuinely present
  const anySignal = hf > 0 || hn > 0 || cit > 0 || stars > 0 || hIdx > 0 || infCit > 0

  return (
    <div className="space-y-5">
      {/* Section heading */}
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm font-black text-white">How We Know This Matters</p>
          <p className="text-xs text-muted/60 mt-0.5">
            Every number below is a real, independent signal that experts and the broader community have taken notice of this research.
          </p>
        </div>
      </div>

      {/* 8 score cards in a responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ScoreCard
          icon="🤗"
          value={hf > 0 ? fmt(hf) : '—'}
          label="HuggingFace Upvotes"
          sublabel="AI engineers bookmarked & upvoted on the world's largest AI platform"
          active={hf > 0}
          highlight="bg-orange-500/8 border-orange-500/25"
        />
        <ScoreCard
          icon="🟠"
          value={hn > 0 ? hnVal : '—'}
          label="Hacker News"
          sublabel="Points + comments from software developers — rare for academic papers"
          active={hn > 0}
          highlight="bg-amber-500/8 border-amber-500/25"
        />
        <ScoreCard
          icon="📚"
          value={cit > 0 ? fmt(cit) : '—'}
          label="Total Citations"
          sublabel="Other papers reference this — citations are academia's currency of trust"
          active={cit > 0}
          highlight="bg-blue-500/8 border-blue-500/25"
        />
        <ScoreCard
          icon="🏆"
          value={infCit > 0 ? fmt(infCit) : '—'}
          label="Influential Citations"
          sublabel="Papers that heavily build on this work — the strongest citation signal"
          active={infCit > 0}
          highlight="bg-indigo-500/8 border-indigo-500/25"
        />
        <ScoreCard
          icon="⭐"
          value={stars > 0 ? fmt(stars) : '—'}
          label="GitHub Stars"
          sublabel="Developers starred the code — means the research ships real working software"
          active={stars > 0}
          highlight="bg-yellow-500/8 border-yellow-500/25"
        />
        <ScoreCard
          icon="🧑‍🔬"
          value={hIdx > 0 ? `h-${Math.round(hIdx)}` : '—'}
          label="Author H-Index"
          sublabel="Lead author's career research influence — higher means a more trusted voice"
          active={hIdx > 0}
          highlight="bg-purple-500/8 border-purple-500/25"
        />
        <ScoreCard
          icon="📈"
          value={citVel > 0 ? velVal : '—'}
          label="Citation Growth"
          sublabel="How fast citations are accelerating — positive means momentum is building"
          active={citVel > 0}
          highlight="bg-green-500/8 border-green-500/25"
        />
        <ScoreCard
          icon="✦"
          value={quality > 0 ? `${quality}/100` : '—'}
          label="Quality Score"
          sublabel="AI-weighted score combining all signals above — our overall confidence rating"
          active={quality > 0}
          highlight="bg-accent/8 border-accent/25"
        />
      </div>

      {/* Plain English context block — only shown when there are real signals */}
      {anySignal && (
        <div className="rounded-2xl bg-surface border border-white/6 p-4 space-y-2 text-sm text-white/75 leading-relaxed">
          <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-3">What These Numbers Mean in Plain English</p>

          {hf > 500 && (
            <p>🤗 When <strong className="text-white">{fmt(hf)} AI practitioners</strong> upvote a paper on HuggingFace, it usually means it directly changes how they build their systems — not just an interesting read.</p>
          )}
          {hf > 0 && hf <= 500 && (
            <p>🤗 <strong className="text-white">{fmt(hf)} AI engineers</strong> bookmarked this on HuggingFace — an early signal from the people who build AI for a living.</p>
          )}
          {hn > 100 && (
            <p>🟠 <strong className="text-white">{hn} points on Hacker News</strong> means thousands of engineers read and upvoted this. Extremely rare for academic research to reach a mainstream developer audience.</p>
          )}
          {hn > 0 && hn <= 100 && (
            <p>🟠 Picked up by the developer community on Hacker News with <strong className="text-white">{hn} points</strong> — it crossed from academia into the engineering world.</p>
          )}
          {infCit > 10 && (
            <p>🏆 <strong className="text-white">{fmt(infCit)} other papers</strong> treat this as foundational — they do not just mention it, they build directly on top of it. That is the deepest form of academic recognition.</p>
          )}
          {infCit > 0 && infCit <= 10 && (
            <p>🏆 <strong className="text-white">{infCit} papers</strong> are already building on top of this research as a foundation.</p>
          )}
          {cit > 50 && !infCit && (
            <p>📚 <strong className="text-white">{fmt(cit)} papers</strong> already cite this — at that citation rate this early, it signals a foundational contribution to the field.</p>
          )}
          {stars > 1000 && (
            <p>⭐ <strong className="text-white">{fmt(stars)} developers</strong> starred the code. Research with that level of GitHub adoption spreads 10× faster and gets adopted into real products.</p>
          )}
          {stars > 0 && stars <= 1000 && (
            <p>⭐ <strong className="text-white">{fmt(stars)} developers</strong> starred the implementation — showing this research ships working, usable software.</p>
          )}
          {hIdx > 40 && (
            <p>🧑‍🔬 The lead author has an h-index of <strong className="text-white">{Math.round(hIdx)}</strong> — placing them among the most cited researchers in their field. Their work carries weight.</p>
          )}
          {hIdx > 10 && hIdx <= 40 && (
            <p>🧑‍🔬 Author h-index of <strong className="text-white">{Math.round(hIdx)}</strong> — a respected, established voice in the research community.</p>
          )}
          {citVel > 0.3 && (
            <p>📈 Citations are accelerating — more papers referenced this work this year than last. Momentum like this typically means the research is becoming a standard reference.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Key Findings ───────────────────────────────────────────────────────────────
function KeyFindings({ findings }: { findings: string[] }) {
  if (!findings?.length) return null
  return (
    <div className="space-y-3">
      <p className="text-xs font-black text-white/50 uppercase tracking-widest">Key Findings</p>
      <div className="rounded-2xl border border-accent/12 bg-surface divide-y divide-white/5 overflow-hidden">
        {findings.map((f, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3.5">
            <CheckCircle2 size={14} className="text-accent shrink-0 mt-0.5" />
            <p className="text-sm text-white/90 leading-snug">{f}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Why Featured ───────────────────────────────────────────────────────────────
function WhyFeatured({ trendReason, trendLabel, whyImportant }: {
  trendReason: string; trendLabel?: string; whyImportant?: string
}) {
  const isGem      = trendLabel?.includes('💎') || trendLabel?.toLowerCase().includes('gem')
  const isTrending = trendLabel?.includes('🔥') || trendLabel?.toLowerCase().includes('trending')
  const isRising   = trendLabel?.includes('📈') || trendLabel?.toLowerCase().includes('rising')

  const Icon        = isGem ? Gem : isTrending ? Flame : isRising ? TrendingUp : Zap
  const iconColor   = isGem ? 'text-purple-400' : isTrending ? 'text-orange-400' : isRising ? 'text-green-400' : 'text-cyan-400'
  const borderColor = isGem ? 'border-purple-500/20' : isTrending ? 'border-orange-500/20' : isRising ? 'border-green-500/20' : 'border-cyan-500/20'
  const bgColor     = isGem ? 'bg-purple-500/5'     : isTrending ? 'bg-orange-500/5'     : isRising ? 'bg-green-500/5'     : 'bg-cyan-500/5'

  return (
    <div className={cn('rounded-2xl border p-5 space-y-2', borderColor, bgColor)}>
      <div className="flex items-center gap-2">
        <Icon size={15} className={iconColor} />
        <p className="text-xs font-black uppercase tracking-widest text-white/50">Why This Is Featured</p>
      </div>
      <p className="text-sm text-white/90 leading-relaxed">{trendReason}</p>
      {whyImportant && whyImportant !== trendReason && (
        <p className="text-sm text-muted/75 leading-relaxed border-t border-white/5 pt-2.5">{whyImportant}</p>
      )}
    </div>
  )
}

// ── Related Stories ────────────────────────────────────────────────────────────
function RelatedStories({ papers, onSelect }: { papers: LandingPaper[]; onSelect: (id: number) => void }) {
  if (!papers.length) return null
  return (
    <div className="space-y-3">
      <p className="text-xs font-black text-white/50 uppercase tracking-widest">Related Stories</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {papers.map(p => {
          const hook = getHook(p)
          const summary = p.ai_lay_summary || p.ai_summary
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="group cursor-pointer bg-surface border border-accent/10 rounded-xl p-4 hover:border-accent/30 hover:bg-surface-2 transition-all space-y-2"
            >
              <p className="text-sm font-semibold text-white/90 line-clamp-2 group-hover:text-white transition-colors leading-snug">
                {truncate(hook, 110)}
              </p>
              {summary && (
                <p className="text-[11px] text-muted/55 line-clamp-2 leading-snug">
                  {truncate(summary, 100)}
                </p>
              )}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-muted/35">{timeAgo(p.published_at)}</span>
                <ArrowRight size={11} className="text-muted/30 group-hover:text-accent transition-colors" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
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
    feedApi.interact(Number(id), 'view').catch(() => {})
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex flex-col items-center py-32 gap-3 text-muted">
        <Loader2 size={26} className="animate-spin text-accent" />
        <p className="text-sm">Loading report…</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex flex-col items-center py-32 gap-4">
        <p className="text-white font-semibold">Could not load this report</p>
        <button onClick={() => navigate(-1)} className="text-xs text-accent hover:underline flex items-center gap-1">
          <ArrowLeft size={11} /> Go back
        </button>
      </div>
    </div>
  )

  const { paper, social_proof, trend_reason, related_papers, topic_meta } = data
  const colors = TC[topic_meta?.color || 'slate']
  const topicPath = paper.ai_topic_category || (paper as any)._derived_topic

  // The journalist narrative hook — never the paper title
  const hook = getHook(paper)

  // Split hook into flowing sentences for newspaper-style hierarchy.
  // Use a simple sentence split that doesn't break on abbreviations.
  const hookSentences = hook
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map(s => s.trim())
    .filter(Boolean)

  // Rich hook = 3+ sentences. Short hook = 1-2 sentences (topic-page style).
  const isRichHook = hookSentences.length >= 3

  // Plain English summary below the hook
  const abstract = paper.ai_lay_summary
    || paper.ai_summary
    || (paper.abstract ? truncate(paper.abstract, 400) : '')

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Breadcrumb ── */}
      <div className={cn('border-b border-accent/10', colors.bg)}>
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-xs text-muted/60 flex-wrap">
            <button onClick={() => navigate('/')} className="hover:text-white transition-colors">Home</button>
            {topic_meta && topicPath && (
              <>
                <ChevronRight size={10} />
                <button
                  onClick={() => navigate(`/explore/${topicPath}`)}
                  className={cn('hover:text-white transition-colors', colors.text)}
                >
                  {topic_meta.emoji} {topic_meta.label}
                </button>
              </>
            )}
            <ChevronRight size={10} />
            <span className="text-white/35">Report</span>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-12">

        {/* ── 1. JOURNALIST NARRATIVE ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="space-y-6"
        >
          {/* Topic + trend badges */}
          <div className="flex flex-wrap items-center gap-2">
            {topic_meta && (
              <span className={cn('px-3 py-1 rounded-full text-xs font-bold border', colors.pill)}>
                {topic_meta.emoji} {topic_meta.label}
              </span>
            )}
            {paper.trend_label && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/55 border border-white/10">
                {paper.trend_label}
              </span>
            )}
          </div>

          {/* The journalist narrative — newspaper hierarchy */}
          {isRichHook ? (
            // Multi-sentence rich hook: first sentence big, rest cascades down
            <div className="space-y-3">
              <p className="text-2xl md:text-3xl font-extrabold text-white leading-snug tracking-tight">
                {hookSentences[0]}
              </p>
              {hookSentences.length > 1 && (
                <p className="text-base md:text-lg text-white/80 leading-relaxed font-medium">
                  {hookSentences.slice(1, 3).join(' ')}
                </p>
              )}
              {hookSentences.length > 3 && (
                <p className="text-sm text-slate-400/75 leading-relaxed">
                  {hookSentences.slice(3).join(' ')}
                </p>
              )}
            </div>
          ) : (
            // Short hook (1-2 sentences): show full-width, then abstract does the heavy lifting
            <p className="text-2xl md:text-3xl font-extrabold text-white leading-snug tracking-tight">
              {hook}
            </p>
          )}

          {/* Plain English abstract */}
          {abstract && (
            <div className="border-l-2 border-accent/30 pl-4 space-y-1">
              <p className="text-[11px] font-semibold text-accent/60 uppercase tracking-widest">In Plain English</p>
              <p className="text-sm text-slate-300/80 leading-relaxed">{abstract}</p>
            </div>
          )}

          {/* Published timestamp only — no author names, no title */}
          <p className="text-xs text-muted/40">{timeAgo(paper.published_at)}</p>
        </motion.div>

        {/* ── 2. CREDIBILITY PANEL ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.4 }}>
          <CredibilityPanel paper={paper} proof={social_proof} />
        </motion.div>

        {/* ── 3. WHY FEATURED ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.4 }}>
          <WhyFeatured
            trendReason={trend_reason}
            trendLabel={paper.trend_label}
            whyImportant={paper.ai_why_important}
          />
        </motion.div>

        {/* ── 4. KEY FINDINGS ── */}
        {paper.ai_key_findings && paper.ai_key_findings.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
            <KeyFindings findings={paper.ai_key_findings} />
          </motion.div>
        )}

        {/* ── 5. READ THE PAPER CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.4 }}
          className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent p-6 space-y-4"
        >
          <div>
            <p className="text-xs font-black text-accent/60 uppercase tracking-widest mb-1">Want the full picture?</p>
            <p className="text-sm text-muted/65 leading-relaxed">
              This is a plain-English report written for curious non-specialists.
              The source paper has all the experiments, data, proofs, and technical methodology — for those who want to go all the way in.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {paper.pdf_url && (
              <a
                href={paper.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-background font-bold text-sm rounded-xl hover:bg-accent/90 transition-all"
              >
                <Download size={13} /> Read the Source Paper
              </a>
            )}
            <button
              onClick={() => navigate(`/paper/${paper.id}`)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface border border-accent/20 text-muted hover:text-white text-sm rounded-xl transition-all"
            >
              <BookOpen size={13} /> Technical Dashboard
            </button>
            {paper.github_url && (
              <a
                href={paper.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface border border-accent/20 text-muted hover:text-white text-sm rounded-xl transition-all"
              >
                <Github size={13} /> View Code on GitHub
              </a>
            )}
          </div>
        </motion.div>

        {/* ── 6. RELATED STORIES ── */}
        {related_papers.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.4 }}>
            <RelatedStories
              papers={related_papers}
              onSelect={newId => navigate(`/report/${newId}`)}
            />
          </motion.div>
        )}

        {/* ── Back / topic nav ── */}
        <div className="flex items-center justify-between pt-2 border-t border-accent/10 pb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
          >
            <ArrowLeft size={12} /> Back
          </button>
          {topic_meta && topicPath && (
            <button
              onClick={() => navigate(`/explore/${topicPath}`)}
              className={cn('flex items-center gap-1.5 text-xs transition-colors', colors.text)}
            >
              More {topic_meta.label} stories <ChevronRight size={11} />
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
