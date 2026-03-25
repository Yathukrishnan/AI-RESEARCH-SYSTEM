export function ScoreBar({ score, label, showValue = true }: { score: number; label?: string; showValue?: boolean }) {
  const pct = Math.min(100, Math.round(score * 100))
  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between text-xs text-muted mb-1">
          {label && <span>{label}</span>}
          {showValue && <span className="text-accent-2 font-mono">{pct}%</span>}
        </div>
      )}
      <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
        <div className="score-bar h-full rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
