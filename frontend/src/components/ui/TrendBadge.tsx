import { cn } from '@/lib/utils'

export function TrendBadge({ label, size = 'sm' }: { label?: string; size?: 'sm' | 'md' }) {
  if (!label) return null
  const isTrending = label.includes('Trending')
  const isRising   = label.includes('Rising')
  const isHidden   = label.includes('Hidden')
  return (
    <span className={cn(
      'inline-flex items-center font-mono font-bold uppercase tracking-wider',
      size === 'sm' ? 'text-[10px]' : 'text-xs',
      isTrending && 'text-orange-400',
      isRising   && 'text-green-400',
      isHidden   && 'text-purple-400',
      !isTrending && !isRising && !isHidden && 'text-accent'
    )}>
      {label}
    </span>
  )
}
