import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'


interface Article {
  id: number
  headline: string
  executive_takeaways: string
  twelve_month_outlook: string
  narrative_body: string
  article_body: string          // legacy fallback
  strategic_outlook: string     // legacy fallback
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
    <a className="text-blue-600 hover:underline font-medium" target="_blank" rel="noopener noreferrer" {...props} />
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
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* ── Header ── */}
      <div className="bg-slate-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-white font-bold text-sm tracking-widest uppercase">AI Research</span>
          <span className="text-slate-500 text-xs">|</span>
          <span className="text-slate-400 text-xs">Strategic Intelligence</span>
        </div>
        <button
          onClick={handleSynthesize}
          disabled={synthesizing}
          className="text-xs px-3 py-1 border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors rounded-sm disabled:opacity-50 disabled:cursor-wait"
        >
          {synthesizing ? 'Synthesizing…' : 'Synthesize Now'}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="max-w-3xl mx-auto px-4 py-12">

        {error && <p className="text-red-600 text-sm mb-6">{error}</p>}
        {loading && <p className="text-slate-400 text-sm">Loading…</p>}

        {!loading && articles.length === 0 && (
          <p className="text-slate-400 text-sm">
            No reports yet. Click "Synthesize Now" to generate the first intelligence briefing.
          </p>
        )}

        <div className="space-y-0">
          {articles.map((article) => {
            const sources = parseJson<{title: string; url: string}>(article.sources_json, [])
            const isExpanded = expandedId === article.id

            // field resolution: prefer new schema, fall back to legacy columns
            const takeaways = article.executive_takeaways || ''
            const outlook = article.twelve_month_outlook || article.strategic_outlook || ''
            const body = article.narrative_body || article.article_body || ''

            return (
              <div
                key={article.id}
                className="prose prose-slate max-w-none dark:prose-invert mb-20 border-b border-slate-200 pb-12"
              >
                {/* Meta */}
                <div className="flex items-center gap-3 mb-6 not-prose">
                  {article.novelty_score > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 bg-slate-900 text-white rounded-sm tracking-wide">
                      {article.novelty_score.toFixed(1)} / 10
                    </span>
                  )}
                  <span className="text-slate-400 text-xs">{timeAgo(article.created_at)}</span>
                </div>

                {/* 1. HEADER */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : article.id)}
                  className="text-left w-full group not-prose"
                >
                  <h2 className="text-4xl font-extrabold tracking-tight mb-8 text-slate-900 dark:text-white group-hover:text-slate-600 transition-colors leading-tight">
                    {article.headline}
                  </h2>
                </button>

                {!isExpanded && (
                  <p className="text-sm text-slate-400 not-prose">Click headline to read full report</p>
                )}

                {isExpanded && (
                  <>
                    {/* 2. EXECUTIVE TAKEAWAYS */}
                    {takeaways && (
                      <section className="not-prose bg-slate-50 dark:bg-slate-900 p-8 rounded-xl border-l-8 border-indigo-600 mb-10 shadow-sm">
                        <h3 className="text-xs uppercase tracking-[0.2em] font-bold mb-4 text-indigo-600">
                          Executive Takeaways
                        </h3>
                        <div className="text-xl font-medium text-slate-800 dark:text-slate-100 space-y-3 prose prose-slate prose-lg max-w-none">
                          <ReactMarkdown components={mdComponents}>{takeaways}</ReactMarkdown>
                        </div>
                      </section>
                    )}

                    {/* 3. 12-MONTH OUTLOOK */}
                    {outlook && (
                      <section className="not-prose mb-12 px-2 border-b border-slate-100 pb-8">
                        <h3 className="text-xs uppercase tracking-[0.2em] font-bold mb-3 text-slate-400">
                          12-Month Outlook
                        </h3>
                        <p className="text-2xl font-serif italic leading-snug text-slate-700 dark:text-slate-300">
                          {outlook}
                        </p>
                      </section>
                    )}

                    {/* 4. DEEP-DIVE ANALYSIS */}
                    {body && (
                      <section className="not-prose text-lg leading-relaxed text-slate-600 dark:text-slate-400 font-normal mb-12">
                        <h3 className="text-xs uppercase tracking-[0.2em] font-bold mb-6 text-slate-400">
                          Deep-Dive Analysis
                        </h3>
                        <div className="whitespace-pre-line prose prose-slate prose-lg max-w-none prose-p:mb-6">
                          <ReactMarkdown components={mdComponents}>{body}</ReactMarkdown>
                        </div>
                      </section>
                    )}

                    {/* 5. REFERENCE EVIDENCE (Hidden Drawer) */}
                    {sources.length > 0 && (
                      <details className="not-prose mt-10 group border border-slate-200 dark:border-slate-800 rounded-lg p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <summary className="text-sm font-bold tracking-widest uppercase text-slate-500 list-none flex items-center justify-between outline-none">
                          <span className="flex items-center gap-3">
                            <span className="text-indigo-500 group-open:rotate-90 transition-transform duration-200">▶</span>
                            Reference Evidence ({sources.length} Primary Sources)
                          </span>
                        </summary>
                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                          <ul className="space-y-3">
                            {sources.map((source, idx) => (
                              <li key={idx} className="flex items-start gap-3 text-sm">
                                <span className="text-indigo-400 mt-0.5">•</span>
                                {source.url ? (
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline font-medium transition-colors"
                                  >
                                    {source.title || source.url}
                                  </a>
                                ) : (
                                  <span className="text-slate-600">{source.title}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {!loading && articles.length > 0 && (
          <div className="mt-8 pt-4 border-t border-gray-200 flex space-x-4 text-sm font-medium text-slate-600">
            {page > 1 && (
              <button onClick={() => setPage(p => p - 1)} className="hover:text-black">← Prev</button>
            )}
            <span>Page {page}</span>
            {articles.length === 20 && (
              <button onClick={() => setPage(p => p + 1)} className="hover:text-black">Next →</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
