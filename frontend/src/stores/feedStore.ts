import { create } from 'zustand'
import { FeedSection, Alert } from '@/lib/types'

interface FeedStore {
  sections: FeedSection[]
  alerts: Alert[]
  currentPage: number
  hasMore: boolean
  totalPapers: number
  isLoading: boolean
  setSections: (sections: FeedSection[], append?: boolean) => void
  setAlerts: (alerts: Alert[]) => void
  setPage: (page: number) => void
  setHasMore: (has: boolean) => void
  setTotalPapers: (total: number) => void
  setLoading: (loading: boolean) => void
}

export const useFeedStore = create<FeedStore>((set) => ({
  sections: [],
  alerts: [],
  currentPage: 0,
  hasMore: true,
  totalPapers: 0,
  isLoading: false,

  setSections: (sections, append = false) =>
    set((state) => ({
      sections: append ? mergeSections(state.sections, sections) : sections,
    })),
  setAlerts: (alerts) => set({ alerts }),
  setPage: (page) => set({ currentPage: page }),
  setHasMore: (has) => set({ hasMore: has }),
  setTotalPapers: (total) => set({ totalPapers: total }),
  setLoading: (loading) => set({ isLoading: loading }),
}))

function mergeSections(existing: FeedSection[], incoming: FeedSection[]): FeedSection[] {
  const merged = [...existing]
  for (const sec of incoming) {
    const idx = merged.findIndex((s) => s.section_type === sec.section_type)
    if (idx >= 0) {
      const existingIds = new Set(merged[idx].papers.map((p) => p.id))
      const newPapers = sec.papers.filter((p) => !existingIds.has(p.id))
      merged[idx] = { ...merged[idx], papers: [...merged[idx].papers, ...newPapers] }
    } else {
      merged.push(sec)
    }
  }
  return merged
}
