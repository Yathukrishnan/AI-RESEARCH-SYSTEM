import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Navbar } from '@/components/layout/Navbar'

interface Article {
  id: number
  headline: string
  executive_takeaways: string
  twelve_month_outlook: string
  narrative_body: string
  article_body: string
  strategic_outlook: string
  references_json: string
  sources_json: string
  novelty_score: number
  created_at: string
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function parseJson<T>(raw: string | T[], fallback: T[]): T[] {
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw as string) } catch { return fallback }
}

const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

const mdComponents = {
  a: ({ node, ...props }: any) => (
    <a className="text-amber-400 hover:text-amber-300 hover:underline font-medium transition-colors" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  p: ({ node, ...props }: any) => (
    <p className="mb-5 leading-relaxed" {...props} />
  ),
  ul: ({ node, ...props }: any) => (
    <ul className="space-y-2 mb-5 list-none" {...props} />
  ),
  li: ({ node, ...props }: any) => (
    <li className="flex items-start gap-2 before:content-['—'] before:text-accent/50 before:font-bold before:shrink-0" {...props} />
  ),
}

export default function AutonomousFeed() {
  const [articles, setArticles] = useState<Article[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [synthesizing, setSynthesizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  async function fetchFeed(p = page) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BASE}/editor/feed?page=${p}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setArticles(data.articles ?? [])
    } catch {
      setError('Could not load feed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFeed(page) }, [page])

  async function handleSynthesize() {
    setSynthesizing(true)
    try {
      const res = await fetch(`${BASE}/editor/generate`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPage(1)
      await fetchFeed(1)
    } catch {
      setError('Synthesis failed.')
    } finally {
      setSynthesizing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />

      {/* Page header */}
      <div className="border-b border-white/7">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-muted/50 uppercase tracking-[0.15em] mb-1">AI Research</p>
            <h1 className="text-[22px] font-black text-white tracking-tight">
              Strategic <span className="text-gradient">Intelligence Feed</span>
            </h1>
            <p className="text-[11px] font-mono text-muted/40 mt-1 uppercase tracking-wider">
              Deep-dive research briefings · auto-synthesised
            </p>
          </div>
          <button
            onClick={handleSynthesize}
            disabled={synthesizing}
            className="text-[12px] font-mono px-4 py-2 border border-white/15 text-muted/70 hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-wait"
          >
            {synthesizing ? 'Synthesising…' : '⟳ Synthesise Now'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 py-12">

        {error && (
          <p className="text-danger/80 text-sm font-mono mb-6 border border-danger/20 bg-danger/5 px-4 py-3">{error}</p>
        )}
        {loading && (
          <div className="space-y-px">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 bg-surface border border-white/8 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && articles.length === 0 && (
          <div className="text-center py-24">
            <p className="text-[13px] font-mono text-muted/40 mb-2 uppercase tracking-wider">No intelligence briefings yet</p>
            <p className="text-[11px] text-muted/25 font-mono">Click "Synthesise Now" to generate the first report</p>
          </div>
        )}

        <div className="space-y-0">
          {articles.map((article) => {
            const sources = parseJson<{title: string; url: string}>(article.sources_json, [])
            const isExpanded = expandedId === article.id
            const takeaways = article.executive_takeaways || ''
            const outlook = article.twelve_month_outlook || article.strategic_outlook || ''
            const body = article.narrative_body || article.article_body || ''

            return (
              <div
                key={article.id}
                className="border-b border-white/8 pb-14 mb-14 last:border-0"
              >
                {/* Meta row */}
                <div className="flex items-center gap-3 mb-5">
                  {article.novelty_score > 0 && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-accent/15 text-accent border border-accent/25 uppercase tracking-wider">
                      {article.novelty_score.toFixed(1)} / 10
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-muted/40 uppercase tracking-wider">
                    {timeAgo(article.created_at)}
                  </span>
                  {!isExpanded && (
                    <span className="text-[10px] font-mono text-muted/25 ml-auto">↓ click to expand</span>
                  )}
                </div>

                {/* Headline */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : article.id)}
                  className="text-left w-full group mb-6"
                >
                  <h2 className="text-[28px] sm:text-[34px] font-black tracking-tight text-white leading-tight group-hover:text-amber-50 transition-colors">
                    {article.headline}
                  </h2>
                </button>

                {isExpanded && (
                  <div className="space-y-8">

                    {/* Executive Takeaways */}
                    {takeaways && (
                      <section className="bg-surface border-l-[3px] border-l-accent px-6 py-5">
                        <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-accent mb-4">
                          Executive Takeaways
                        </h3>
                        <div className="text-[15px] text-slate-200 leading-relaxed">
                          <ReactMarkdown components={mdComponents}>{takeaways}</ReactMarkdown>
                        </div>
                      </section>
                    )}

                    {/* 12-Month Outlook */}
                    {outlook && (
                      <section className="border-b border-white/8 pb-8">
                        <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted/50 mb-3">
                          12-Month Outlook
                        </h3>
                        <p className="text-[20px] font-bold text-white/80 leading-snug italic">
                          "{outlook}"
                        </p>
                      </section>
                    )}

                    {/* Deep-Dive */}
                    {body && (
                      <section>
                        <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted/50 mb-6">
                          Deep-Dive Analysis
                        </h3>
                        <div className="text-[14px] leading-relaxed text-slate-400">
                          <ReactMarkdown components={mdComponents}>{body}</ReactMarkdown>
                        </div>
                      </section>
                    )}

                    {/* Sources */}
                    {sources.length > 0 && (
                      <details className="group border border-white/8 cursor-pointer">
                        <summary className="text-[11px] font-mono font-bold tracking-widest uppercase text-muted/50 list-none flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors outline-none">
                          <span className="flex items-center gap-3">
                            <span className="text-accent/60 group-open:rotate-90 transition-transform duration-200 inline-block">▶</span>
                            Reference Evidence ({sources.length} Sources)
                          </span>
                        </summary>
                        <div className="px-4 pb-4 pt-3 border-t border-white/8 space-y-2.5">
                          {sources.map((source, idx) => (
                            <div key={idx} className="flex items-start gap-3 text-[12px] font-mono">
                              <span className="text-accent/40 mt-0.5 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                              {source.url ? (
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-accent/70 hover:text-accent hover:underline transition-colors line-clamp-2"
                                >
                                  {source.title || source.url}
                                </a>
                              ) : (
                                <span className="text-muted/60">{source.title}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {!loading && articles.length > 0 && (
          <div className="mt-8 pt-4 border-t border-white/8 flex items-center gap-6 text-[12px] font-mono text-muted/50">
            {page > 1 && (
              <button onClick={() => setPage(p => p - 1)} className="hover:text-white transition-colors">← Prev</button>
            )}
            <span>Page {page}</span>
            {articles.length === 20 && (
              <button onClick={() => setPage(p => p + 1)} className="hover:text-white transition-colors">Next →</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
