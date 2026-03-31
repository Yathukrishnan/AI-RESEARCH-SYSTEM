import { motion } from 'framer-motion'
import { Github, Bookmark, ExternalLink, Quote, Star, Eye, Crown, ThumbsUp, TrendingUp, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { DashboardPaper } from '@/lib/types'
import { feedApi } from '@/lib/api'
import { isSaved, savePaper, unsavePaper, dailyHook } from '@/lib/utils'
import toast from 'react-hot-toast'

const EDITORIAL_TAGS = [
  "TODAY'S PICK",
  "FEATURED RESEARCH",
  "MUST READ",
  "BREAKTHROUGH",
  "COMMUNITY TOP PICK",
  "WEEK'S BEST",
  "EDITOR'S CHOICE",
]

interface Props { paper: DashboardPaper }

function getSpotlight(paper: DashboardPaper): { badge: string; title: string; bio: string } {
  const hIndex = Math.round(paper.h_index_max || 0)
  const name = paper.authors?.[0]?.name || 'the author'
  if (hIndex >= 70) return {
    badge: 'VIP SPOTLIGHT · ELITE AUTHOR',
    title: 'The Heavyweight',
    bio: `The field listens when ${name} publishes. With an h-index of ${hIndex}, this researcher shapes AI's trajectory — their latest pre-print is already drawing attention.`,
  }
  if (hIndex >= 40) return {
    badge: 'TOP RESEARCHER · HIGH IMPACT',
    title: 'The Authority',
    bio: `${name} (h-index ${hIndex}) is among the most influential voices in AI. This paper is generating significant interest across the community.`,
  }
  if (paper.hf_upvotes && paper.hf_upvotes > 50) return {
    badge: 'COMMUNITY FAVOURITE · HUGGING FACE',
    title: 'The Crowd Pick',
    bio: `The Hugging Face community has pushed this paper to the top with ${paper.hf_upvotes} upvotes. Practitioner signal at its strongest.`,
  }
  if ((paper.trending_score || 0) > 0) return {
    badge: 'TRENDING · COMMUNITY BUZZ',
    title: 'The Breakout',
    bio: `This paper is generating real buzz across AI communities right now — one of the fastest rising papers in the feed this week.`,
  }
  return {
    badge: "EDITOR'S PICK · HIGH SCORE",
    title: 'The Deep Cut',
    bio: `A high-signal paper our scoring system ranked among this week's best — strong on citations, methodology, and community relevance.`,
  }
}

function ScoreRing({ score, label = 'Score' }: { score: number; label?: string }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  return (
    <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} stroke="#1e2a4a" strokeWidth="8" fill="none" />
        <circle
          cx="48" cy="48" r={r}
          stroke={score >= 80 ? '#f59e0b' : score >= 60 ? '#6366f1' : '#22d3ee'}
          strokeWidth="8" fill="none"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black text-white leading-none">{score}</span>
        <span className="text-[9px] text-muted font-bold uppercase tracking-widest">{label}</span>
      </div>
    </div>
  )
}

function StatBox({ icon: Icon, value, label, color }: {
  icon: React.ElementType; value: string | number; label: string; color: string
}) {
  return (
    <div className="flex flex-col items-center justify-center p-3 bg-white/4 rounded-xl border border-white/8 gap-1">
      <Icon size={14} className={color} />
      <span className={`text-lg font-black leading-none ${color}`}>{value}</span>
      <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">{label}</span>
    </div>
  )
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

export function HeroHook({ paper }: Props) {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(isSaved(paper.id))
  const { badge, title, bio } = getSpotlight(paper)
  const topAuthor = paper.authors?.[0]
  const hIndex = Math.round(paper.h_index_max || topAuthor?.h_index || 0)

  // Hero impact score: blends quality (normalized_score) with social momentum (HF + HN + citation velocity).
  // Emerging papers with high community discussion score higher here than on the raw quality ring alone.
  const hfNorm   = Math.min(1, Math.log(1 + (paper.hf_upvotes || 0))                                       / Math.log(101))
  const hnNorm   = Math.min(1, Math.log(1 + (paper.hn_points || 0) + (paper.hn_comments || 0) * 0.5)       / Math.log(201))
  const citVel   = Math.min(1, paper.citation_velocity || 0)
  const social   = 0.40 * hfNorm + 0.35 * hnNorm + 0.25 * citVel
  const hasSocialData = (paper.hf_upvotes || 0) > 0 || (paper.hn_points || 0) > 0
  const heroScore = hasSocialData
    ? Math.round((0.50 * (paper.normalized_score || 0) + 0.50 * social) * 100)
    : Math.round((paper.normalized_score || 0) * 100)

  const editorialTag = dailyHook(EDITORIAL_TAGS)

  const platforms: string[] = []
  if ((paper.hf_upvotes || 0) > 0) platforms.push('Hugging Face')
  if ((paper.hn_points || 0) > 0) platforms.push('Hacker News')
  if ((paper.github_stars || 0) > 0) platforms.push('GitHub')
  platforms.push('arXiv')

  const handleView = () => {
    feedApi.interact(paper.id, 'view').catch(() => {})
    navigate(`/paper/${paper.id}`)
  }

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (saved) { unsavePaper(paper.id); setSaved(false); toast.success('Removed') }
    else { savePaper(paper.id); setSaved(true); toast.success('Saved') }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl border border-yellow-500/20 cursor-pointer group"
      style={{
        background: 'linear-gradient(135deg, #050d2e 0%, #0a1628 60%, #050d1a 100%)',
        boxShadow: '0 0 60px rgba(245,158,11,0.08), 0 0 0 1px rgba(245,158,11,0.1)',
      }}
      onClick={handleView}
    >
      {/* Glow */}
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-accent/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row gap-0">
        {/* ── Left: main content ── */}
        <div className="flex-1 px-6 py-6 sm:px-8 sm:py-7 min-w-0">
          {/* Editorial tag + spotlight label */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-yellow-400/15 border border-yellow-400/40 text-yellow-300 tracking-widest uppercase animate-pulse">
              <Zap size={9} className="shrink-0" /> {editorialTag}
            </span>
            <span className="text-[10px] font-semibold text-yellow-400/50 tracking-widest uppercase">
              {badge}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Crown size={16} className="text-yellow-400 shrink-0" />
            <span className="text-base font-bold text-yellow-300">{title}</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-2">{bio}</p>

          {/* Authors */}
          <div className="flex items-center gap-2 flex-wrap mb-5">
            {topAuthor && (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/25 text-yellow-300">
                <Crown size={10} /> {topAuthor.name}
              </span>
            )}
            {hIndex > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/6 border border-white/10 text-slate-300">
                h-index {hIndex}
              </span>
            )}
            {paper.authors.slice(1, 3).map((a) => (
              <span key={a.name} className="text-xs text-slate-500">{a.name}</span>
            ))}
            {paper.authors.length > 3 && (
              <span className="text-xs text-slate-600">+{paper.authors.length - 3} more</span>
            )}
          </div>

          {/* Hook headline */}
          <div className="mb-3">
            {paper.hook_text ? (
              <p className="text-xl sm:text-2xl font-black text-white leading-snug group-hover:text-yellow-100 transition-colors">
                {paper.hook_text}
              </p>
            ) : (
              <p className="text-xl sm:text-2xl font-black text-white leading-snug group-hover:text-yellow-100 transition-colors">
                {paper.title}
              </p>
            )}
            {paper.hook_text && (
              <p className="text-[11px] text-slate-600 font-mono mt-1 line-clamp-1">↳ {paper.title}</p>
            )}
          </div>

          {/* Community signals — HF + HN always shown, others when non-zero */}
          {(() => {
            type Chip = { icon: React.ElementType; value: string; label: string; color: string; bg: string; dim?: boolean }
            const chips: Chip[] = []

            // HuggingFace upvotes — always visible (hero is guaranteed to have HF or HN)
            chips.push({
              icon: ThumbsUp,
              value: fmt(paper.hf_upvotes || 0),
              label: 'HF upvotes',
              color: (paper.hf_upvotes || 0) > 0 ? 'text-orange-300' : 'text-slate-500',
              bg:    (paper.hf_upvotes || 0) > 0 ? 'bg-orange-500/12 border-orange-500/30' : 'bg-white/4 border-white/10',
              dim:   (paper.hf_upvotes || 0) === 0,
            })

            // HackerNews points — always visible
            chips.push({
              icon: TrendingUp,
              value: fmt(paper.hn_points || 0),
              label: 'HN points',
              color: (paper.hn_points || 0) > 0 ? 'text-amber-300' : 'text-slate-500',
              bg:    (paper.hn_points || 0) > 0 ? 'bg-amber-500/12 border-amber-500/30' : 'bg-white/4 border-white/10',
              dim:   (paper.hn_points || 0) === 0,
            })

            // Citations — always visible
            chips.push({
              icon: Quote,
              value: fmt(paper.citation_count || 0),
              label: 'citations',
              color: (paper.citation_count || 0) > 0 ? 'text-indigo-300' : 'text-slate-500',
              bg:    (paper.citation_count || 0) > 0 ? 'bg-indigo-500/12 border-indigo-500/30' : 'bg-white/4 border-white/10',
              dim:   (paper.citation_count || 0) === 0,
            })

            // GitHub stars — only when non-zero
            if ((paper.github_stars || 0) > 0)
              chips.push({ icon: Star, value: fmt(paper.github_stars!), label: 'GitHub stars', color: 'text-yellow-300', bg: 'bg-yellow-500/12 border-yellow-500/30' })

            // Author h-index — only when non-zero
            if (hIndex > 0)
              chips.push({ icon: Crown, value: `h${hIndex}`, label: 'h-index', color: 'text-yellow-400', bg: 'bg-yellow-500/12 border-yellow-500/30' })

            return (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Community signal:</span>
                {chips.map(c => (
                  <span
                    key={c.label}
                    className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${c.bg} ${c.color} ${c.dim ? 'opacity-40' : ''}`}
                  >
                    <c.icon size={10} />
                    {c.value} <span className="font-normal opacity-70">{c.label}</span>
                  </span>
                ))}
              </div>
            )
          })()}

          {/* Abstract snippet */}
          {paper.abstract && (
            <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 mb-5">
              {paper.abstract}
            </p>
          )}

          {/* Topic tags */}
          {paper.ai_topic_tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {paper.ai_topic_tags.slice(0, 5).map((tag) => (
                <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent-2">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleView}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black text-sm font-bold rounded-xl hover:bg-yellow-300 transition-all"
            >
              <ExternalLink size={13} /> Read Pre-print
            </button>
            {paper.github_url && (
              <a
                href={paper.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-white/6 border border-white/12 text-sm text-slate-300 rounded-xl hover:bg-white/10 transition-all"
              >
                <Github size={13} /> Code
              </a>
            )}
            <button
              onClick={handleSave}
              className={`p-2 rounded-xl border transition-all ${saved ? 'bg-accent/20 border-accent/40 text-accent-2' : 'bg-white/6 border-white/12 text-slate-400 hover:text-white'}`}
            >
              <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* ── Right: stats panel ── */}
        <div
          className="lg:w-60 shrink-0 border-t lg:border-t-0 lg:border-l border-white/6 px-6 py-6 flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Score ring */}
          <div className="flex justify-center">
            <ScoreRing score={heroScore} label={hasSocialData ? 'Impact' : 'Score'} />
          </div>

          {/* Stats grid — HF Votes + HN Points always shown as primary social proof */}
          <div className="grid grid-cols-2 gap-2">
            <StatBox icon={ThumbsUp}   value={fmt(paper.hf_upvotes || 0)}     label="HF Votes"  color={(paper.hf_upvotes || 0) > 0 ? 'text-orange-400' : 'text-slate-600'} />
            <StatBox icon={TrendingUp} value={fmt(paper.hn_points || 0)}      label="HN Points" color={(paper.hn_points || 0) > 0 ? 'text-amber-400' : 'text-slate-600'} />
            <StatBox icon={Quote}      value={fmt(paper.citation_count || 0)} label="Citations" color={(paper.citation_count || 0) > 0 ? 'text-accent-2' : 'text-slate-600'} />
            <StatBox icon={Eye}        value={fmt(paper.view_count || 0)}     label="Views"     color="text-cyan-400" />
            {(paper.github_stars || 0) > 0 && (
              <StatBox icon={Star}  value={fmt(paper.github_stars!)} label="Stars"   color="text-yellow-400" />
            )}
            {hIndex > 0 && (
              <StatBox icon={Crown} value={hIndex}                   label="H-Index" color="text-yellow-400" />
            )}
          </div>

          {/* Trending on */}
          {platforms.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-2">Trending on</p>
              <div className="flex flex-wrap gap-1.5">
                {platforms.map((p) => (
                  <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 border border-white/10 text-slate-300 font-medium">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
