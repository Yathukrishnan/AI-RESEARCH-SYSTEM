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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-surface border border-white/8 border-l-[3px] border-l-accent/50 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl shrink-0">{digest.emoji}</span>
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold text-white">{digest.topic}</h3>
            <p className="text-[10px] font-mono text-muted/50 mt-0.5 uppercase tracking-wider">
              {digest.papers.length} papers · journalist digest
            </p>
          </div>
        </div>
        <div className="shrink-0 text-muted/40">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {/* Article body */}
            <div className="px-5 pb-5 border-t border-white/6">
              <div className="pt-4 space-y-3">
                {paragraphs.map((para, i) => (
                  <p key={i} className="text-[13px] text-slate-300/80 leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>

              {/* Source papers */}
              <div className="mt-5 pt-4 border-t border-white/6">
                <p className="text-[10px] font-mono text-muted/40 uppercase tracking-[0.15em] font-bold mb-3">
                  Sources — {digest.papers.length} papers
                </p>
                <div className="space-y-1">
                  {digest.papers.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-start gap-3 cursor-pointer px-3 py-2.5 hover:bg-surface-2 transition-colors group border-l-2 border-l-transparent hover:border-l-accent/30"
                      onClick={() => navigate(`/paper/${p.id}`)}
                    >
                      <span className="text-[10px] font-mono font-bold text-muted/30 shrink-0 w-4 mt-0.5 tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-slate-200 group-hover:text-white transition-colors leading-snug line-clamp-2">
                          {p.title}
                        </p>
                        {p.hook_text && (
                          <p className="text-[10px] font-mono text-muted/45 mt-0.5 leading-snug line-clamp-1">{p.hook_text}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {p.hf_upvotes > 0 && (
                            <span className="text-[10px] font-mono text-muted/40">🤗 {p.hf_upvotes}</span>
                          )}
                          {p.hn_points > 0 && (
                            <span className="text-[10px] font-mono text-muted/40">HN {p.hn_points}</span>
                          )}
                          <span className="text-[10px] font-mono text-muted/25">{p.arxiv_id}</span>
                        </div>
                      </div>
                      <a
                        href={`https://arxiv.org/abs/${p.arxiv_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="shrink-0 text-muted/25 hover:text-accent transition-colors mt-0.5"
                      >
                        <ExternalLink size={11} />
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
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper size={14} className="text-accent/60" />
          <h2 className="text-[12px] font-mono font-bold text-white uppercase tracking-widest">Today's Research Digest</h2>
          <Loader2 size={12} className="animate-spin text-muted/40 ml-1" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-surface border border-white/8 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!digests.length) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Newspaper size={14} className="text-accent/60" />
        <h2 className="text-[12px] font-mono font-bold text-white uppercase tracking-widest">Today's Research Digest</h2>
        <span className="text-[10px] font-mono text-muted/40 ml-1">· {digests.length} topics</span>
      </div>
      <p className="text-[11px] font-mono text-muted/40 -mt-1 mb-3">
        Top papers from each field, written as news articles.
      </p>
      {digests.map((d, i) => (
        <DigestCard key={d.topic} digest={d} index={i} />
      ))}
    </div>
  )
}
