import { cn } from '@/lib/utils'

export function TrendBadge({ label, size = 'sm' }: { label?: string; size?: 'sm' | 'md' }) {
  if (!label) return null
  const isTrending = label.includes('Trending')
  const isRising = label.includes('Rising')
  const isHidden = label.includes('Hidden')
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-semibold',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      isTrending && 'badge-trending',
      isRising && 'badge-rising',
      isHidden && 'badge-hidden',
      !isTrending && !isRising && !isHidden && 'bg-accent/20 text-accent-2 border border-accent/30'
    )}>
      {label}
    </span>
  )
}
