import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface Article {
  id: number
  headline: string
  article_body: string
  points: number
  cluster_count: number
  paper_ids: string
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

const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

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
          <span className="text-white font-bold text-sm tracking-widest uppercase">
            AI Research
          </span>
          <span className="text-slate-500 text-xs">|</span>
          <span className="text-slate-400 text-xs">Editor Feed</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleSynthesize}
            disabled={synthesizing}
            className="text-xs px-3 py-1 border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors rounded-sm disabled:opacity-50 disabled:cursor-wait"
          >
            {synthesizing ? 'Synthesizing…' : 'Synthesize Now'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-3xl mx-auto px-4 py-8">

        {error && (
          <p className="text-red-600 text-sm mb-6">{error}</p>
        )}

        {loading && (
          <p className="text-slate-400 text-sm">Loading…</p>
        )}

        {!loading && articles.length === 0 && (
          <p className="text-slate-400 text-sm">
            No articles yet. Click "Synthesize Now" to generate the first batch.
          </p>
        )}

        <ol className="space-y-0">
          {articles.map((article, i) => (
            <li key={article.id} className="border-b border-gray-200 py-3">

              {/* Title line */}
              <div className="flex items-baseline gap-2">
                <span className="text-slate-400 text-xs w-5 shrink-0 text-right">{i + 1}.</span>
                <button
                  onClick={() => setExpandedId(expandedId === article.id ? null : article.id)}
                  className="text-slate-900 text-sm font-medium text-left hover:text-slate-600 transition-colors leading-snug"
                >
                  {article.headline}
                </button>
              </div>

              {/* Subtext line */}
              <div className="ml-7 mt-0.5 text-slate-400 text-xs">
                {article.points} pts · AI-Editor · {timeAgo(article.created_at)} · {article.cluster_count} papers
              </div>

              {/* Expanded body */}
              {expandedId === article.id && (
                <div className="ml-7 mt-3 mb-1 p-5 bg-white border-l-4 border-slate-800 text-slate-700 leading-relaxed shadow-sm text-sm">
                  <ReactMarkdown components={{ a: ({node, ...props}) => <a className="text-blue-600 hover:underline font-medium" target="_blank" rel="noopener noreferrer" {...props} /> }}>{article.article_body}</ReactMarkdown>
                </div>
              )}
            </li>
          ))}
        </ol>

        {/* Pagination */}
        {!loading && articles.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 flex space-x-4 text-sm font-medium text-slate-600">
            {page > 1 && (
              <button onClick={() => setPage(p => p - 1)} className="hover:text-black">
                ← Prev
              </button>
            )}
            <span>Page {page}</span>
            {articles.length === 20 && (
              <button onClick={() => setPage(p => p + 1)} className="hover:text-black">
                Next →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
