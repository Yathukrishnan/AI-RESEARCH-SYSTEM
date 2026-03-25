import { useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import { Loader2, Inbox } from 'lucide-react'
import { feedApi } from '@/lib/api'
import { useFeedStore } from '@/stores/feedStore'
import { FeedSection } from './FeedSection'
import { SuggestionBlock } from './SuggestionBlock'
import { ResumeReading } from './ResumeReading'
import { SkeletonGrid } from '@/components/ui/SkeletonCard'
import { AlertBanner } from '@/components/alerts/AlertBanner'

const FILTER_MAP: Record<string, string[]> = {
  trending: ['trending'],
  gems:     ['hidden_gems'],
  new:      ['new'],
  all:      [],
}

export function Feed({ filter = 'all' }: { filter?: string }) {
  const {
    sections, alerts, currentPage, hasMore, isLoading,
    setSections, setAlerts, setPage, setHasMore, setTotalPapers, setLoading,
  } = useFeedStore()
  const { ref: bottomRef, inView } = useInView({ threshold: 0.1 })
  const initialized = useRef(false)

  const loadFeed = async (page: number, append = false) => {
    setLoading(true)
    try {
      const res = await feedApi.getFeed(page)
      const data = res.data
      setSections(data.sections || [], append)
      setHasMore(data.has_more)
      setTotalPapers(data.total_papers)
      if (page === 0 && data.alerts) setAlerts(data.alerts)
    } catch (err) {
      console.error('Feed load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      loadFeed(0)
    }
  }, [])

  useEffect(() => {
    if (inView && hasMore && !isLoading && sections.length > 0) {
      const nextPage = currentPage + 1
      setPage(nextPage)
      loadFeed(nextPage, true)
    }
  }, [inView])

  if (isLoading && sections.length === 0) {
    return (
      <div className="space-y-10">
        {alerts.length > 0 && <AlertBanner alerts={alerts} />}
        <SkeletonGrid count={6} />
      </div>
    )
  }

  if (!isLoading && sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Inbox size={48} className="text-muted mb-4 opacity-40" />
        <h3 className="text-lg font-semibold text-white mb-2">No papers yet</h3>
        <p className="text-muted text-sm max-w-md">
          The system is scoring and ranking AI research papers. This may take a few minutes on first run.
          Check back soon or trigger a fetch from the admin panel.
        </p>
      </div>
    )
  }

  // Inject suggestion blocks at specific positions
  const BLOCKS: Record<number, 'pulse' | 'topics' | 'streak'> = { 0: 'streak', 2: 'topics', 4: 'pulse' }

  const allowed = FILTER_MAP[filter] ?? []
  const visible = allowed.length > 0
    ? sections.filter((s) => allowed.includes(s.section_type))
    : sections

  return (
    <div className="space-y-10">
      {alerts.length > 0 && <AlertBanner alerts={alerts} />}
      <ResumeReading />

      {visible.map((section, i) => (
        <div key={section.section_type} className="space-y-8">
          <FeedSection section={section} sectionIndex={i} />
          {BLOCKS[i] !== undefined && <SuggestionBlock type={BLOCKS[i]} index={i} />}
        </div>
      ))}

      <div ref={bottomRef} className="h-10 flex items-center justify-center">
        {isLoading && (
          <div className="flex items-center gap-2 text-muted text-sm">
            <Loader2 size={15} className="animate-spin" /> Loading more...
          </div>
        )}
        {!hasMore && sections.length > 0 && (
          <p className="text-muted/50 text-xs">
            All caught up · {sections.reduce((acc, s) => acc + s.papers.length, 0)} papers shown
          </p>
        )}
      </div>
    </div>
  )
}
