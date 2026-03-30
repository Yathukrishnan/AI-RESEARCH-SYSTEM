import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { DashboardPaper } from '@/lib/types'
import { feedApi } from '@/lib/api'
import { timeAgo, dailyHook } from '@/lib/utils'

const HOOKS = [
  "Quiet at launch — suddenly surging today",
  "Citation velocity spiking: these papers are accelerating fast",
  "Slow burn papers suddenly catching fire across the field",
  "The momentum shift you don't want to miss this week",
  "Papers the algorithm didn't catch first — but you will",
  "From obscure to essential — watch these climb in real time",
  "Scores moving fast. These papers are on a trajectory",
]

interface Props { papers: DashboardPaper[] }

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) {
    return <div className="w-16 h-6 bg-surface-2 rounded opacity-30" />
  }
  const w = 64, h = 24
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 0.01
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h * 0.85}`
  ).join(' ')
  const rising = data[data.length - 1] > data[0]
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={rising ? '#10b981' : '#818cf8'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function VelocityDesk({ papers }: Props) {
  const navigate = useNavigate()

  const handleView = (paper: DashboardPaper) => {
    feedApi.interact(paper.id, 'view').catch(() => {})
    navigate(`/paper/${paper.id}`)
  }

  if (!papers.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.3 }}
      className="bg-surface border border-emerald-500/15 rounded-2xl p-5 space-y-4"
      style={{ boxShadow: '0 0 24px rgba(16,185,129,0.07)' }}
    >
      <div>
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity size={14} className="text-emerald-400" /> Velocity Desk
        </h2>
        <p className="text-xs text-muted mt-0.5">{dailyHook(HOOKS)}</p>
      </div>

      <div className="space-y-3">
        {papers.map((paper) => {
          const vel = paper.citation_velocity || 0
          const score = Math.round((paper.normalized_score || 0) * 100)
          return (
            <div
              key={paper.id}
              onClick={() => handleView(paper)}
              className="flex items-start gap-4 p-3 bg-surface-2 border border-emerald-500/10 rounded-xl cursor-pointer hover:border-emerald-500/30 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-emerald-300 transition-colors">
                  {paper.hook_text || paper.title}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted flex-wrap">
                  {paper.authors?.[0] && <span>{paper.authors[0].name}</span>}
                  <span className="text-emerald-400 font-mono font-bold">↑{vel.toFixed(2)} vel</span>
                  <span className="font-mono text-accent-2">{score}%</span>
                  <span>{timeAgo(paper.published_at)}</span>
                </div>
              </div>
              <Sparkline data={paper.score_history || []} />
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
