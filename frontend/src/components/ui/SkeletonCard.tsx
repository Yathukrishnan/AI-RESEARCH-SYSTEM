export function SkeletonCard() {
  return (
    <div className="bg-surface border border-accent/10 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full shimmer bg-surface-2" />
          <div className="h-5 w-12 rounded-full shimmer bg-surface-2" />
        </div>
        <div className="h-5 w-20 rounded-full shimmer bg-surface-2" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-5 w-full rounded shimmer bg-surface-2" />
        <div className="h-5 w-4/5 rounded shimmer bg-surface-2" />
      </div>
      <div className="space-y-1.5 mb-4">
        <div className="h-4 w-full rounded shimmer bg-surface-2" />
        <div className="h-4 w-full rounded shimmer bg-surface-2" />
        <div className="h-4 w-3/4 rounded shimmer bg-surface-2" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-28 rounded-lg shimmer bg-surface-2" />
        <div className="h-8 w-24 rounded-lg shimmer bg-surface-2" />
        <div className="h-8 w-20 rounded-lg shimmer bg-surface-2" />
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}
