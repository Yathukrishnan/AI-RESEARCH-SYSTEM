/**
 * Magic UI components — HexagonPattern, TextHighlight, RippleButton
 * Inspired by magic-ui.design
 */
import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/* ── Hexagon Pattern Background ──────────────────────────────────────── */

export function HexagonPattern({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}>
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="hex-bg"
            x="0"
            y="0"
            width="56"
            height="48.5"
            patternUnits="userSpaceOnUse"
          >
            {/* flat-top hexagon */}
            <path
              d="M28 0 L56 16.2 L56 48.5 L28 64.7 L0 48.5 L0 16.2 Z"
              fill="none"
              stroke="rgba(232,160,32,0.055)"
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex-bg)" />
      </svg>
      {/* Radial fade-out from centre so pattern is subtle at edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 10%, transparent 40%, #0a0a0a 100%)',
        }}
      />
    </div>
  )
}

/* ── Text Highlight ───────────────────────────────────────────────────── */

interface HighlightProps {
  children: React.ReactNode
  /** Delay before the highlight animates in (seconds) */
  delay?: number
  color?: 'amber' | 'orange' | 'green' | 'purple'
}

const HIGHLIGHT_COLORS = {
  amber:  'rgba(232,160,32,0.28)',
  orange: 'rgba(249,115,22,0.25)',
  green:  'rgba(34,197,94,0.22)',
  purple: 'rgba(168,85,247,0.22)',
}

const TEXT_COLORS = {
  amber:  'text-amber-200',
  orange: 'text-orange-200',
  green:  'text-green-200',
  purple: 'text-purple-200',
}

export function Highlight({ children, delay = 0.25, color = 'amber' }: HighlightProps) {
  return (
    <motion.mark
      initial={{ backgroundSize: '0% 88%' }}
      whileInView={{ backgroundSize: '100% 88%' }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, ease: 'easeOut', delay }}
      className={cn('relative inline rounded-[3px] px-0.5 font-bold', TEXT_COLORS[color])}
      style={{
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'left center',
        backgroundImage: `linear-gradient(120deg, ${HIGHLIGHT_COLORS[color]}, ${HIGHLIGHT_COLORS[color]})`,
        WebkitBoxDecorationBreak: 'clone',
        boxDecorationBreak: 'clone',
      }}
    >
      {children}
    </motion.mark>
  )
}

/* ── Ripple Button ────────────────────────────────────────────────────── */

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  rippleColor?: string
  variant?: 'default' | 'ghost' | 'amber'
}

interface RippleEntry {
  id: number
  x: number
  y: number
  size: number
}

export function RippleButton({
  children,
  onClick,
  className,
  rippleColor,
  variant = 'default',
  disabled,
  ...props
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<RippleEntry[]>([])
  const btnRef = useRef<HTMLButtonElement>(null)

  const baseColor =
    rippleColor ??
    (variant === 'amber' ? 'rgba(232,160,32,0.35)' : 'rgba(255,255,255,0.18)')

  const variantClass = {
    default: 'bg-surface-2 border border-white/10 text-white/70 hover:text-white hover:border-white/20',
    ghost:   'border border-white/10 text-muted/60 hover:text-white hover:border-white/20',
    amber:   'bg-accent text-black font-bold hover:bg-accent-2',
  }[variant]

  const addRipple = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const size = Math.max(rect.width, rect.height) * 2
    const id = Date.now() + Math.random()
    setRipples(r => [...r, { id, x, y, size }])
    setTimeout(() => setRipples(r => r.filter(rip => rip.id !== id)), 700)
    onClick?.(e)
  }, [onClick])

  return (
    <button
      ref={btnRef}
      onClick={addRipple}
      disabled={disabled}
      className={cn(
        'relative overflow-hidden transition-colors select-none',
        variantClass,
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {children}
      {ripples.map(r => (
        <span
          key={r.id}
          className="pointer-events-none absolute rounded-full animate-click-ripple"
          style={{
            left: r.x - r.size / 2,
            top: r.y - r.size / 2,
            width: r.size,
            height: r.size,
            background: baseColor,
          }}
        />
      ))}
    </button>
  )
}
