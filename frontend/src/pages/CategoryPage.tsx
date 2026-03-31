import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Flame, Gem, Zap, TrendingUp, LayoutGrid } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { PaperCard } from '@/components/feed/PaperCard'
import { feedApi } from '@/lib/api'

type CategoryType = 'trending' | 'gems' | 'new' | 'rising' | 'all'

const META: Record<CategoryType, {
  label: string
  emoji: string
  icon: React.ElementType
  desc: string
  iconColor: string
  border: string
  bg: string
}> = {
  trending: {
    label: 'Trending Papers',
    emoji: '🔥',
    icon: Flame,
    desc: 'Highest-ranked papers the AI research community is reading right now.',
    iconColor: 'text-orange-400',
    border: 'border-orange-500/30',
    bg: 'bg-orange-500/5',
  },
  gems: {
    label: 'Hidden Gems',
    emoji: '💎',
    icon: Gem,
    desc: "High-impact papers that haven't gone viral yet. Strong signal, low noise.",
    iconColor: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/5',
  },
  new: {
    label: 'New Papers',
    emoji: '✨',
    icon: Zap,
    desc: 'Latest arXiv submissions added in the last 48 hours, scored and ranked.',
    iconColor: 'text-cyan-400',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/5',
  },
  rising: {
    label: 'Rising Fast',
    emoji: '📈',
    icon: TrendingUp,
    desc: 'Papers climbing the rankings fast — ones to watch before everyone else.',
    iconColor: 'text-green-400',
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
  },
  all: {
    label: 'All Papers',
    emoji: '🗂️',
    icon: LayoutGrid,
    desc: 'All ranked papers in the intelligence feed.',
    iconColor: 'text-accent-2',
    border: 'border-accent/30',
    bg: 'bg-accent/5',
  },
}

export function CategoryPage() {
  const { type = 'trending' } = useParams<{ type: string }>()
  const navigate = useNavigate()
  const cat = (META[type as CategoryType] ? type : 'all') as CategoryType
  const meta = META[cat]

  const [papers, setPapers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (pg: number, append = false) => {
    if (pg === 0) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await feedApi.getPapersByType(cat, pg)
      const data = res.data
      setPapers((prev) => append ? [...prev, ...data.papers] : data.papers)
      setTotal(data.total)
      setHasMore(data.has_more)
    } catch {
      // silent
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [cat])

  useEffect(() => {
    setPapers([])
    setPage(0)
    load(0)
  }, [cat, load])

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    load(next, true)
  }

  const Icon = meta.icon

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <div className={`border-b border-accent/10`}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors mb-5"
          >
            <ArrowLeft size={13} /> Back
          </button>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className={`inline-flex items-center gap-3 rounded-2xl px-5 py-4 border ${meta.border} ${meta.bg}`}
          >
            <span className="text-3xl">{meta.emoji}</span>
            <div>
              <h1 className="text-2xl font-bold text-white">{meta.label}</h1>
              <p className="text-sm text-muted mt-0.5">{meta.desc}</p>
            </div>
          </motion.div>

          {!loading && total > 0 && (
            <p className="text-xs text-muted mt-4">
              <span className="text-white font-semibold">{total.toLocaleString()}</span> papers
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted">
            <Loader2 size={28} className="animate-spin text-accent" />
            <p className="text-sm">Loading {meta.label.toLowerCase()}…</p>
          </div>
        ) : papers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <Icon size={40} className={`${meta.iconColor} opacity-30`} />
            <p className="text-white font-semibold">No papers here yet</p>
            <p className="text-muted text-sm max-w-sm">
              Papers will appear here once they're fetched and scored. Check the admin panel to trigger a fetch.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {papers.map((paper, i) => (
                <motion.div
                  key={paper.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
                >
                  <PaperCard paper={paper} index={i} />
                </motion.div>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-surface border border-accent/20 text-sm text-muted hover:text-white hover:border-accent/40 rounded-xl transition-all flex items-center gap-2"
                >
                  {loadingMore ? (
                    <><Loader2 size={13} className="animate-spin" /> Loading…</>
                  ) : (
                    `Load more`
                  )}
                </button>
              </div>
            )}

            {!hasMore && papers.length > 0 && (
              <p className="text-center text-xs text-muted mt-8">
                All {total.toLocaleString()} papers loaded
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
