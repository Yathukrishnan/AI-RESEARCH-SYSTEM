import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Zap, Compass, Brain, Flame } from 'lucide-react'
import { useFeedStore } from '@/stores/feedStore'
import { feedApi } from '@/lib/api'

type BlockType = 'pulse' | 'topics' | 'streak'

interface Props {
  type: BlockType
  index?: number
}

const TOPIC_CATEGORIES = [
  { label: 'LLM', query: 'large language model', color: 'bg-purple-500/15 text-purple-300 border-purple-500/25 hover:bg-purple-500/25' },
  { label: 'Computer Vision', query: 'computer vision', color: 'bg-green-500/15 text-green-300 border-green-500/25 hover:bg-green-500/25' },
  { label: 'Reinforcement Learning', query: 'reinforcement learning', color: 'bg-orange-500/15 text-orange-300 border-orange-500/25 hover:bg-orange-500/25' },
  { label: 'Diffusion Models', query: 'diffusion model', color: 'bg-pink-500/15 text-pink-300 border-pink-500/25 hover:bg-pink-500/25' },
  { label: 'Transformers', query: 'transformer attention', color: 'bg-blue-500/15 text-blue-300 border-blue-500/25 hover:bg-blue-500/25' },
  { label: 'Multimodal', query: 'multimodal vision language', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25 hover:bg-cyan-500/25' },
  { label: 'Reasoning', query: 'chain of thought reasoning', color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25 hover:bg-yellow-500/25' },
  { label: 'Alignment', query: 'alignment rlhf safety', color: 'bg-red-500/15 text-red-300 border-red-500/25 hover:bg-red-500/25' },
  { label: 'Efficient AI', query: 'quantization efficient inference', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/25' },
  { label: 'Graph Neural Nets', query: 'graph neural network', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25 hover:bg-indigo-500/25' },
]

function PulseBlock() {
  const { totalPapers, sections } = useFeedStore()
  const trendingCount = sections.find((s) => s.section_type === 'trending')?.papers.length ?? 0
  const gemsCount = sections.find((s) => s.section_type === 'hidden_gems')?.papers.length ?? 0

  const stats = [
    { label: 'Papers in feed', value: totalPapers.toLocaleString(), icon: Brain, color: 'text-accent-2' },
    { label: 'Trending now', value: trendingCount.toString(), icon: Flame, color: 'text-orange-400' },
    { label: 'Hidden gems', value: gemsCount.toString(), icon: Zap, color: 'text-purple-400' },
  ]

  return (
    <div className="suggestion-block p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Brain size={16} className="text-accent-2" />
        <h3 className="text-sm font-semibold text-white">Research Intelligence Pulse</h3>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-success">
          <span className="live-dot" /> updating daily
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="text-center space-y-1">
            <div className={`text-xl font-bold ${color} tabular-nums`}>{value}</div>
            <div className="text-xs text-muted leading-tight">{label}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted/70 text-center">
        Papers scored by AI · Ranked by relevance · Updated every 24h
      </p>
    </div>
  )
}

function TopicsBlock() {
  const navigate = useNavigate()

  const search = (query: string) => {
    navigate(`/?q=${encodeURIComponent(query)}`)
    feedApi.getFeed(0).catch(() => {})
  }

  return (
    <div className="suggestion-block p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Compass size={16} className="text-accent-2" />
        <h3 className="text-sm font-semibold text-white">Explore by Research Topic</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {TOPIC_CATEGORIES.map(({ label, query, color }) => (
          <button
            key={label}
            onClick={() => search(query)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all cursor-pointer ${color}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted/60">Click a topic to search the research database</p>
    </div>
  )
}

function StreakBlock() {
  const savedCount = (() => {
    try { return JSON.parse(localStorage.getItem('saved_papers') ?? '[]').length }
    catch { return 0 }
  })()
  const viewedToday = (() => {
    try {
      const key = `views_${new Date().toDateString()}`
      return parseInt(localStorage.getItem(key) ?? '0', 10)
    } catch { return 0 }
  })()

  return (
    <div className="suggestion-block p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-accent-2" />
        <h3 className="text-sm font-semibold text-white">Your Research Activity</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-2 rounded-xl p-3 text-center border border-accent/10">
          <div className="text-2xl font-bold text-accent-2">{savedCount}</div>
          <div className="text-xs text-muted mt-0.5">Saved papers</div>
        </div>
        <div className="bg-surface-2 rounded-xl p-3 text-center border border-success/10">
          <div className="text-2xl font-bold text-success">{viewedToday}</div>
          <div className="text-xs text-muted mt-0.5">Viewed today</div>
        </div>
      </div>
      {savedCount === 0 && (
        <p className="text-xs text-muted/60 text-center">
          Save papers with the 🔖 button to track your reading list
        </p>
      )}
    </div>
  )
}

export function SuggestionBlock({ type, index = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 + 0.2, duration: 0.4 }}
    >
      {type === 'pulse'   && <PulseBlock />}
      {type === 'topics'  && <TopicsBlock />}
      {type === 'streak'  && <StreakBlock />}
    </motion.div>
  )
}
