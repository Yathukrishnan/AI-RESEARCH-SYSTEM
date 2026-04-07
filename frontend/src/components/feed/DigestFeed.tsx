import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, ExternalLink, Loader2, Newspaper } from 'lucide-react'
import { feedApi } from '@/lib/api'
import { useNavigate } from 'react-router-dom'

interface DigestPaper {
  id: number
  arxiv_id: string
  title: string
  hook_text: string
  score: number
  hf_upvotes: number
  hn_points: number
}

interface Digest {
  topic: string
  emoji: string
  article: string
  papers: DigestPaper[]
}

function DigestCard({ digest, index }: { digest: Digest; index: number }) {
  const [expanded, setExpanded] = useState(index === 0)
  const navigate = useNavigate()

  const paragraphs = digest.article
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean)

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="bg-surface border border-accent/15 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-white/3 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">{digest.emoji}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">{digest.topic}</h3>
            <p className="text-xs text-muted mt-0.5">
              {digest.papers.length} papers · journalist digest
            </p>
          </div>
        </div>
        <div className="shrink-0 text-muted">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {/* Article */}
            <div className="px-5 pb-4 border-t border-accent/10">
              <div className="pt-4 space-y-3">
                {paragraphs.map((para, i) => (
                  <p key={i} className="text-sm text-slate-300 leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>

              {/* Source papers */}
              <div className="mt-5 pt-4 border-t border-accent/10">
                <p className="text-[11px] text-muted uppercase tracking-wide font-semibold mb-3">
                  Sources — {digest.papers.length} papers
                </p>
                <div className="space-y-2">
                  {digest.papers.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-start gap-3 group cursor-pointer rounded-xl p-2.5 hover:bg-white/4 transition-colors"
                      onClick={() => navigate(`/paper/${p.id}`)}
                    >
                      <span className="text-[11px] font-bold text-muted shrink-0 w-4 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors leading-snug line-clamp-2">
                          {p.title}
                        </p>
                        {p.hook_text && (
                          <p className="text-[11px] text-muted mt-0.5 leading-snug">{p.hook_text}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {p.hf_upvotes > 0 && (
                            <span className="text-[10px] text-slate-500">🤗 {p.hf_upvotes}</span>
                          )}
                          {p.hn_points > 0 && (
                            <span className="text-[10px] text-slate-500">HN {p.hn_points}</span>
                          )}
                          <span className="text-[10px] text-slate-600">{p.arxiv_id}</span>
                        </div>
                      </div>
                      <a
                        href={`https://arxiv.org/abs/${p.arxiv_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="shrink-0 text-muted hover:text-accent-2 transition-colors mt-0.5"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function DigestFeed() {
  const [digests, setDigests] = useState<Digest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    feedApi.getDigests()
      .then((r: any) => setDigests(r.data || []))
      .catch(() => setDigests([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper size={16} className="text-accent-2" />
          <h2 className="text-sm font-bold text-white">Today's Research Digest</h2>
          <Loader2 size={13} className="animate-spin text-muted ml-1" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-surface border border-accent/15 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!digests.length) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Newspaper size={16} className="text-accent-2" />
        <h2 className="text-sm font-bold text-white">Today's Research Digest</h2>
        <span className="text-[11px] text-muted ml-1">· {digests.length} topics covered</span>
      </div>
      <p className="text-xs text-muted -mt-1 mb-3">
        Top papers from each field, written as news articles. Sources listed below each story.
      </p>
      {digests.map((d, i) => (
        <DigestCard key={d.topic} digest={d} index={i} />
      ))}
    </div>
  )
}
