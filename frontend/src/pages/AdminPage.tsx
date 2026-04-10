import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, FileText, Settings, Tag, RefreshCw, Plus, Trash2,
  Play, ArrowLeft, Database, TrendingUp, Brain, CheckCircle, Loader2,
  Activity, Users, Eye, Copy, Shield, ShieldOff, Wifi, WifiOff, Zap,
  Clock, BookOpen, Star, AlertTriangle, Download, Layers, Globe, Network,
  Search, Github, MessageSquare, FlaskConical, ExternalLink, ListTree, ChevronDown, ChevronRight
} from 'lucide-react'
import { adminApi } from '@/lib/api'
import { AdminStats, ConfigItem, Keyword, Subject, AnalysisLog, AdminUser } from '@/lib/types'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ── Sidebar ───────────────────────────────────────────────────────────────────

function AdminSidebar() {
  const location = useLocation()
  const links = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/analysis', label: 'Analysis', icon: Activity },
    { to: '/admin/papers', label: 'Papers', icon: FileText },
    { to: '/admin/keywords', label: 'Keywords', icon: Tag },
    { to: '/admin/topics', label: 'Topics', icon: Globe },
    { to: '/admin/mapping', label: 'Mapping', icon: Network },
    { to: '/admin/subjects', label: 'Subjects', icon: Layers },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/config', label: 'Config', icon: Settings },
    { to: '/admin/apis', label: 'APIs', icon: Wifi },
    { to: '/admin/quality-check', label: 'Quality Check', icon: FlaskConical },
    { to: '/admin/editor-runs', label: 'Editor Runs', icon: ListTree },
  ]

  return (
    <aside className="w-56 shrink-0 bg-surface border border-accent/15 rounded-2xl p-3 self-start sticky top-20">
      <p className="text-xs text-muted px-2 pb-2 font-semibold uppercase tracking-wide">Admin Panel</p>
      <nav className="space-y-1">
        {links.map(({ to, label, icon: Icon }) => {
          const active = to === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'text-white bg-accent/20 border border-accent/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIST(utcStr: string | null | undefined): string {
  if (!utcStr) return '—'
  try {
    return new Date(utcStr).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  } catch { return utcStr }
}

function duration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '—'
  try {
    const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
    if (secs < 60) return `${secs}s`
    const m = Math.floor(secs / 60), s = secs % 60
    return `${m}m ${s}s`
  } catch { return '—' }
}

// ── DailyFetchCard ────────────────────────────────────────────────────────────

function DailyFetchCard({ onReset }: { onReset: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    adminApi.getDailyFetch()
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const log = data?.log ?? {}
  const today = data?.today ?? {}
  const papers = data?.papers ?? []

  const statusColor: Record<string, string> = {
    running: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    storing: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    enriching: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    scoring: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    complete: 'text-green-400 bg-green-500/10 border-green-500/30',
  }
  const statusClass = log.status ? (statusColor[log.status] ?? 'text-muted bg-surface-2 border-accent/20') : 'text-muted bg-surface-2 border-accent/20'

  return (
    <div className="bg-surface border border-accent/15 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-accent/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download size={15} className="text-accent-2" />
          <h2 className="text-sm font-semibold text-white">Today's Fetch</h2>
          {log.status && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusClass}`}>
              {log.status}
            </span>
          )}
        </div>
        <button onClick={load} className="text-xs text-muted hover:text-white transition-colors flex items-center gap-1">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="px-5 py-6 flex items-center gap-2 text-muted text-sm">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Timing row */}
          <div className="px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 border-b border-accent/5 text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <Clock size={11} className="text-accent-2" />
              <span className="text-slate-400">Started (IST):</span>
              <span className="text-white font-medium">{toIST(log.started_at)}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted">
              <Clock size={11} className="text-green-400" />
              <span className="text-slate-400">Finished (IST):</span>
              <span className="text-white font-medium">{toIST(log.finished_at)}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted">
              <span className="text-slate-400">Duration:</span>
              <span className="text-white font-medium">{duration(log.started_at, log.finished_at)}</span>
            </span>
            {log.notes && (
              <span className="text-muted italic">{log.notes}</span>
            )}
          </div>

          {/* Count pills */}
          <div className="px-5 py-3 flex flex-wrap gap-3 border-b border-accent/5">
            {[
              { label: 'Fetched', value: today.total ?? log.total_papers ?? 0, color: 'text-accent-2' },
              { label: 'Scored', value: today.scored ?? log.scored_papers ?? 0, color: 'text-purple-400' },
              { label: 'Enriched', value: today.enriched ?? 0, color: 'text-cyan-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-2 bg-surface-2 border border-accent/10 rounded-xl px-3 py-1.5">
                <span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span>
                <span className="text-xs text-muted">{label}</span>
              </div>
            ))}
            {!log.status && (
              <p className="text-xs text-muted self-center">No fetch has run yet today. Next auto-fetch at 8:00 AM IST.</p>
            )}
          </div>

          {/* Paper list */}
          {papers.length > 0 ? (
            <div className="divide-y divide-accent/5 max-h-64 overflow-y-auto">
              {papers.map((p: any) => (
                <div key={p.arxiv_id} className="px-5 py-2.5 flex items-center justify-between gap-4 hover:bg-surface-2 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white line-clamp-1">{p.title}</p>
                    <p className="text-xs text-muted mt-0.5">{p.primary_category} · {p.arxiv_id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    {p.citation_count > 0 && (
                      <span className="text-yellow-400 flex items-center gap-0.5"><BookOpen size={10} /> {p.citation_count}</span>
                    )}
                    {p.github_stars > 0 && (
                      <span className="text-orange-400 flex items-center gap-0.5"><Star size={10} /> {p.github_stars}</span>
                    )}
                    {p.is_enriched ? (
                      <span className="text-cyan-400"><CheckCircle size={11} /></span>
                    ) : (
                      <span className="text-muted"><Clock size={11} /></span>
                    )}
                    <span className={`font-mono font-bold ${(p.normalized_score ?? 0) > 0.7 ? 'text-green-400' : (p.normalized_score ?? 0) > 0.4 ? 'text-yellow-400' : 'text-muted'}`}>
                      {p.normalized_score != null ? (p.normalized_score * 100).toFixed(1) : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-4 text-xs text-muted">
              No papers fetched yet today. The scheduler runs at 8:00 AM IST (2:30 AM UTC).
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── EnrichmentCard ────────────────────────────────────────────────────────────

function EnrichmentCard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  const load = () => {
    setLoading(true)
    adminApi.getEnrichmentStatus()
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleReset = async () => {
    setResetting(true)
    try {
      const res: any = await adminApi.resetFailedEnrichment()
      toast.success(`Reset ${res?.reset_count ?? 0} papers for re-enrichment`)
      load()
    } catch {
      toast.error('Reset failed')
    } finally {
      setResetting(false)
    }
  }

  if (loading) return (
    <div className="bg-surface border border-accent/15 rounded-2xl px-5 py-6 flex items-center gap-2 text-muted text-sm">
      <Loader2 size={14} className="animate-spin" /> Loading enrichment status…
    </div>
  )
  if (!data) return null

  const bars = [
    { label: 'Enriched (attempted)', value: data.enriched, pct: data.enrichment_pct, color: 'bg-cyan-400' },
    { label: 'With citation data', value: data.with_citations, pct: data.citations_pct, color: 'bg-yellow-400' },
    { label: 'With GitHub stars', value: data.with_github, pct: data.github_pct, color: 'bg-orange-400' },
  ]

  return (
    <div className="bg-surface border border-accent/15 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-accent/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-yellow-400" />
          <h2 className="text-sm font-semibold text-white">Citation &amp; GitHub Enrichment</h2>
        </div>
        <div className="flex items-center gap-2">
          {data.failed_rate_limit > 0 && (
            <button
              onClick={handleReset} disabled={resetting}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 rounded-lg hover:bg-yellow-500/20 disabled:opacity-50 transition-all"
            >
              {resetting ? <Loader2 size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
              Reset {data.failed_rate_limit} failed
            </button>
          )}
          <button onClick={load} className="text-xs text-muted hover:text-white flex items-center gap-1 transition-colors">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Progress bars */}
        <div className="space-y-2.5">
          {bars.map(({ label, value, pct, color }) => (
            <div key={label} className="flex items-center gap-3">
              <p className="text-xs text-muted w-40 shrink-0">{label}</p>
              <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-mono text-white w-20 text-right shrink-0 tabular-nums">
                {value.toLocaleString()} <span className="text-muted">({pct}%)</span>
              </span>
            </div>
          ))}
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {(data.pending_old ?? 0) > 0 && (
            <span className="text-xs px-2 py-1 bg-surface-2 border border-accent/10 rounded-lg text-muted">
              <span className="text-white font-medium">{(data.pending_old).toLocaleString()}</span> old papers — awaiting citation lookup
            </span>
          )}
          {(data.pending_new ?? 0) > 0 && (
            <span className="text-xs px-2 py-1 bg-surface-2 border border-blue-500/20 rounded-lg text-blue-300">
              <span className="font-medium">{(data.pending_new).toLocaleString()}</span> new papers — citation enrichment deferred (citations not in score yet)
            </span>
          )}
          {data.failed_rate_limit > 0 && (
            <span className="text-xs px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400">
              <span className="font-medium">{data.failed_rate_limit}</span> rate-limited (429)
            </span>
          )}
        </div>

        {/* Top by citations */}
        {data.top_by_citations?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
              <BookOpen size={11} className="text-yellow-400" /> Top by Citations
            </p>
            <div className="space-y-1">
              {data.top_by_citations.map((p: any) => (
                <div key={p.arxiv_id} className="flex items-center justify-between gap-3 text-xs">
                  <p className="text-white line-clamp-1 flex-1">{p.title}</p>
                  <span className="text-yellow-400 font-bold shrink-0 tabular-nums">{p.citation_count.toLocaleString()} cit.</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top by GitHub stars */}
        {data.top_by_github?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
              <Star size={11} className="text-orange-400" /> Top by GitHub Stars
            </p>
            <div className="space-y-1">
              {data.top_by_github.map((p: any) => (
                <div key={p.arxiv_id} className="flex items-center justify-between gap-3 text-xs">
                  <p className="text-white line-clamp-1 flex-1">{p.title}</p>
                  <span className="text-orange-400 font-bold shrink-0 tabular-nums">
                    <Star size={9} className="inline mr-0.5" />{p.github_stars.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.with_citations === 0 && data.with_github === 0 && (
          <p className="text-xs text-muted">
            No citation or GitHub data yet. Enrichment runs hourly (100 papers/run) using Semantic Scholar and Papers With Code.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

interface DashboardData {
  stats: AdminStats
  recent_papers: any[]
  analysis: any
  analysis_summary: any
}

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchDays, setFetchDays] = useState('1')
  const [triggering, setTriggering] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    adminApi.getDashboard()
      .then((r) => setData(r.data as DashboardData))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const trigger = async (action: 'fetch' | 'rescore' | 'enrich' | 'reset-enrich') => {
    setTriggering(action)
    try {
      if (action === 'fetch') await adminApi.triggerFetch(parseInt(fetchDays) || 1)
      else if (action === 'rescore') await adminApi.triggerRescore()
      else if (action === 'enrich') await adminApi.triggerEnrich(200)
      else {
        const res: any = await adminApi.resetFailedEnrichment()
        toast.success(`Reset ${res?.reset_count ?? 0} papers for re-enrichment`)
        setTimeout(load, 1000)
        return
      }
      toast.success(`${action === 'fetch' ? 'Fetch' : action === 'rescore' ? 'Rescore' : 'Enrich'} triggered!`)
      setTimeout(load, 2000)
    } catch {
      toast.error('Action failed')
    } finally {
      setTriggering(null)
    }
  }

  if (loading) return <div className="flex items-center gap-2 text-muted"><Loader2 size={16} className="animate-spin" /> Loading...</div>

  const s = data?.stats
  const statCards = [
    { label: 'Total Papers',  value: s?.total_papers      ?? 0, icon: Database,   color: 'text-accent-2',   bg: 'bg-accent/8'   },
    { label: 'Scored',        value: s?.scored_papers     ?? 0, icon: Brain,       color: 'text-purple-400', bg: 'bg-purple-500/8' },
    { label: 'Visible',       value: s?.visible_papers    ?? 0, icon: Eye,         color: 'text-success',    bg: 'bg-success/8'  },
    { label: 'Trending',      value: s?.trending_papers   ?? 0, icon: TrendingUp,  color: 'text-orange-400', bg: 'bg-orange-500/8' },
    { label: 'Enriched',      value: s?.enriched_papers   ?? 0, icon: CheckCircle, color: 'text-cyan-400',   bg: 'bg-cyan-500/8' },
    { label: 'AI Validated',  value: s?.ai_validated_papers ?? 0, icon: Brain,     color: 'text-pink-400',   bg: 'bg-pink-500/8' },
    { label: 'Duplicates',    value: s?.duplicate_papers  ?? 0, icon: Copy,        color: 'text-red-400',    bg: 'bg-red-500/8'  },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-accent/20 rounded-xl text-xs text-muted hover:text-white transition-all">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-surface border border-accent/15 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">{label}</p>
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={13} className={color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Score distribution hint */}
      {(s?.total_papers ?? 0) > 0 && (
        <div className="bg-surface border border-accent/15 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-white">Pipeline Health</p>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Coverage (scored/total)', pct: s?.total_papers ? Math.round((s.scored_papers / s.total_papers) * 100) : 0, color: 'bg-purple-400' },
              { label: 'Visibility (above threshold)', pct: s?.total_papers ? Math.round((s.visible_papers / s.total_papers) * 100) : 0, color: 'bg-success' },
              { label: 'Enrichment rate', pct: s?.total_papers ? Math.round((s.enriched_papers / s.total_papers) * 100) : 0, color: 'bg-cyan-400' },
              { label: 'AI validation rate', pct: s?.total_papers ? Math.round((s.ai_validated_papers / s.total_papers) * 100) : 0, color: 'bg-pink-400' },
            ].map(({ label, pct, color }) => (
              <div key={label} className="flex items-center gap-3">
                <p className="text-xs text-muted w-44 shrink-0">{label}</p>
                <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-mono text-white w-9 text-right shrink-0">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="number" min="1" max="90" value={fetchDays}
              onChange={(e) => setFetchDays(e.target.value)}
              className="w-16 bg-surface-2 border border-accent/20 rounded-xl py-2 px-3 text-sm text-white text-center focus:outline-none focus:border-accent/50"
            />
            <span className="text-xs text-muted">days</span>
          </div>
          <button
            onClick={() => trigger('fetch')} disabled={!!triggering}
            className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 text-accent-2 text-sm font-medium rounded-xl hover:bg-accent/20 disabled:opacity-50 transition-all"
          >
            {triggering === 'fetch' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Fetch Papers
          </button>
          <button
            onClick={() => trigger('rescore')} disabled={!!triggering}
            className="flex items-center gap-2 px-4 py-2 bg-highlight/10 border border-highlight/30 text-cyan-300 text-sm font-medium rounded-xl hover:bg-highlight/20 disabled:opacity-50 transition-all"
          >
            {triggering === 'rescore' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Rescore All
          </button>
          <button
            onClick={() => trigger('enrich')} disabled={!!triggering}
            title="Fetch citation counts + GitHub data for up to 200 unenriched papers"
            className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-300 text-sm font-medium rounded-xl hover:bg-green-500/20 disabled:opacity-50 transition-all"
          >
            {triggering === 'enrich' ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Enrich Now
          </button>
          <button
            onClick={() => trigger('reset-enrich')} disabled={!!triggering}
            title="Reset papers marked enriched with zero data (rate-limit failures) so they retry"
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm font-medium rounded-xl hover:bg-yellow-500/20 disabled:opacity-50 transition-all"
          >
            {triggering === 'reset-enrich' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Reset Failed
          </button>
        </div>
        <p className="text-xs text-muted">
          <span className="text-green-400 font-medium">Enrich</span> fetches citation counts &amp; GitHub stars from Semantic Scholar / Papers With Code.
          Auto-runs hourly (100 papers/run). <span className="text-yellow-400 font-medium">Reset Failed</span> re-queues papers that got rate-limited (429) during enrichment.
        </p>
      </div>

      {/* Daily Fetch section */}
      <DailyFetchCard onReset={load} />

      {/* Citation & GitHub Enrichment section */}
      <EnrichmentCard />

      {/* Recent papers */}
      {(data?.recent_papers?.length ?? 0) > 0 && (
        <div className="bg-surface border border-accent/15 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-accent/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent Papers</h2>
            <span className="text-xs text-muted">{data!.recent_papers.length} shown</span>
          </div>
          <div className="divide-y divide-accent/5">
            {data!.recent_papers.map((p: any) => (
              <div key={p.arxiv_id} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-surface-2 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white line-clamp-1">{p.title}</p>
                  <p className="text-xs text-muted mt-0.5">{p.primary_category} · {p.arxiv_id}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {p.is_trending ? <span className="text-xs text-orange-400">🔥</span> : null}
                  <span className={`text-xs font-mono font-bold ${(p.normalized_score ?? 0) > 0.7 ? 'text-success' : (p.normalized_score ?? 0) > 0.4 ? 'text-warning' : 'text-muted'}`}>
                    {p.normalized_score != null ? (p.normalized_score * 100).toFixed(1) : '—'}
                  </span>
                  <span className="text-xs text-muted">{p.view_count ?? 0} views</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Analysis ──────────────────────────────────────────────────────────────────

function AnalysisAdmin() {
  const [log, setLog] = useState<AnalysisLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [polling, setPolling] = useState(false)
  const [hooksStatus, setHooksStatus] = useState<{ total: number; with_rich_hooks: number; missing_hooks: number; percent: number } | null>(null)
  const [hooksProgress, setHooksProgress] = useState<{ status: string; total: number; done: number; failed: number; percent: number; started_at: string | null; finished_at: string | null } | null>(null)
  const [hooksPolling, setHooksPolling] = useState(false)

  const loadHooksStatus = () => {
    adminApi.getRichHooksStatus()
      .then(r => setHooksStatus(r.data))
      .catch(() => {})
  }

  const loadHooksProgress = () => {
    adminApi.getRichHooksProgress()
      .then(r => {
        setHooksProgress(r.data)
        if (r.data.status === 'running') setHooksPolling(true)
        else setHooksPolling(false)
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (!hooksPolling) return
    const t = setInterval(() => {
      loadHooksProgress()
      // Refresh coverage stats every 10s while running
      loadHooksStatus()
    }, 3000)
    return () => clearInterval(t)
  }, [hooksPolling])

  const load = () => {
    loadHooksStatus()
    loadHooksProgress()
    adminApi.getAnalysisStatus()
      .then((r) => {
        setLog(r.data.latest_run || null)
        if (r.data.latest_run?.status === 'running') setPolling(true)
        else setPolling(false)
      })
      .catch(() => toast.error('Failed to load analysis status'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!polling) return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [polling])

  const runAnalysis = async (force: boolean) => {
    setRunning(true)
    try {
      await adminApi.runAnalysis(force)
      toast.success('Analysis started!')
      setTimeout(load, 1000)
      setPolling(true)
    } catch {
      toast.error('Failed to start analysis')
    } finally {
      setRunning(false)
    }
  }

  const generateHooks = async (force: boolean) => {
    setRunning(true)
    try {
      await adminApi.generateHooks(500, force)
      toast.success(force ? 'Regenerating ALL hooks (500 papers)…' : 'Filling missing hooks (500 papers)…')
    } catch {
      toast.error('Failed to start hook generation')
    } finally {
      setRunning(false)
    }
  }

  const generateRichHooks = async (force: boolean) => {
    setRunning(true)
    try {
      await adminApi.triggerRichHooks(5000, force)
      toast.success(force ? 'Regenerating ALL rich journalist hooks — all papers…' : 'Filling missing rich hooks — all papers…')
    } catch {
      toast.error('Failed to start rich hook generation')
    } finally {
      setRunning(false)
    }
  }

  const statusColor = (s?: string) => {
    if (s === 'complete') return 'text-success'
    if (s === 'running') return 'text-accent-2'
    if (s === 'error') return 'text-red-400'
    return 'text-muted'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Analysis Pipeline</h1>

      {/* Actions */}
      <div className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Run Analysis</h2>
        <p className="text-xs text-muted">Scores, deduplicates and ranks all papers. Safe to re-run.</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runAnalysis(false)}
            disabled={running || log?.status === 'running'}
            className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 text-accent-2 text-sm font-medium rounded-xl hover:bg-accent/20 disabled:opacity-50 transition-all"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Run (unscored only)
          </button>
          <button
            onClick={() => runAnalysis(true)}
            disabled={running || log?.status === 'running'}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm font-medium rounded-xl hover:bg-orange-500/20 disabled:opacity-50 transition-all"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Force Re-score All
          </button>
          <button
            onClick={() => generateHooks(false)}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm font-medium rounded-xl hover:bg-purple-500/20 disabled:opacity-50 transition-all"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <span>✦</span>}
            Fill Missing Hooks
          </button>
          <button
            onClick={() => generateHooks(true)}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-pink-500/10 border border-pink-500/30 text-pink-400 text-sm font-medium rounded-xl hover:bg-pink-500/20 disabled:opacity-50 transition-all"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <span>↺</span>}
            Regenerate ALL Hooks
          </button>
        </div>

        {/* Rich journalist hooks — Wired/Atlantic style, 4-6 sentences */}
        <div className="pt-3 border-t border-white/5">
          <p className="text-xs text-muted mb-3">
            <span className="text-white font-semibold">Rich Journalist Hooks</span> — generates magazine-style 4-6 sentence hooks for the Topic &amp; Report pages. Run after adding new papers.
          </p>

          {/* Coverage stats (idle/done state) */}
          {hooksStatus && hooksProgress?.status !== 'running' && (
            <div className="mb-4 space-y-2 bg-surface-2 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Rich hooks coverage</span>
                <span className="text-muted">
                  {hooksStatus.with_rich_hooks.toLocaleString()} / {hooksStatus.total.toLocaleString()} papers
                  <span className={cn('ml-2 font-bold', hooksStatus.percent === 100 ? 'text-green-400' : hooksStatus.percent >= 60 ? 'text-yellow-400' : 'text-red-400')}>
                    {hooksStatus.percent}%
                  </span>
                </span>
              </div>
              <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500',
                    hooksStatus.percent === 100 ? 'bg-green-500' : hooksStatus.percent >= 60 ? 'bg-yellow-500' : 'bg-teal-500'
                  )}
                  style={{ width: `${hooksStatus.percent}%` }}
                />
              </div>
              <p className="text-xs text-muted">
                {hooksStatus.missing_hooks > 0
                  ? `⚠️ ${hooksStatus.missing_hooks.toLocaleString()} papers still need rich hooks — click "Fill Missing Rich Hooks" below`
                  : '✅ All papers have rich journalist hooks'}
              </p>
            </div>
          )}

          {/* Live progress — shown while job is running */}
          {hooksProgress && hooksProgress.status === 'running' && (
            <div className="mb-4 space-y-3 bg-teal-500/5 border border-teal-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Loader2 size={13} className="animate-spin text-teal-400" />
                <span className="text-sm font-semibold text-white">Generating rich hooks…</span>
                <span className="ml-auto text-xs text-teal-400 font-bold tabular-nums">{hooksProgress.percent}%</span>
              </div>
              <div className="w-full h-3 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-700"
                  style={{ width: `${hooksProgress.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  <span className="text-green-400 font-semibold">{hooksProgress.done.toLocaleString()} done</span>
                  {hooksProgress.failed > 0 && <span className="text-red-400 ml-2">{hooksProgress.failed} failed</span>}
                  <span className="ml-2">of {hooksProgress.total.toLocaleString()} papers</span>
                </span>
                <span>{hooksProgress.total - hooksProgress.done - hooksProgress.failed} remaining</span>
              </div>
            </div>
          )}

          {/* Last run summary — shown after completion */}
          {hooksProgress && hooksProgress.status === 'done' && hooksProgress.total > 0 && (
            <div className="mb-4 bg-green-500/5 border border-green-500/20 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-green-400">✅ Job complete</p>
              <p className="text-xs text-muted">
                {hooksProgress.done.toLocaleString()} hooks generated
                {hooksProgress.failed > 0 && `, ${hooksProgress.failed} failed`}
                {' '}out of {hooksProgress.total.toLocaleString()} papers
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { generateRichHooks(false); setTimeout(() => { loadHooksProgress(); setHooksPolling(true) }, 1500) }}
              disabled={running || hooksProgress?.status === 'running'}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-sm font-medium rounded-xl hover:bg-teal-500/20 disabled:opacity-50 transition-all"
            >
              {hooksProgress?.status === 'running' ? <Loader2 size={14} className="animate-spin" /> : <span>📰</span>}
              Fill Missing Rich Hooks
            </button>
            <button
              onClick={() => { generateRichHooks(true); setTimeout(() => { loadHooksProgress(); setHooksPolling(true) }, 1500) }}
              disabled={running || hooksProgress?.status === 'running'}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-medium rounded-xl hover:bg-cyan-500/20 disabled:opacity-50 transition-all"
            >
              {hooksProgress?.status === 'running' ? <Loader2 size={14} className="animate-spin" /> : <span>↺</span>}
              Regenerate ALL Rich Hooks
            </button>
          </div>
        </div>
      </div>

      {/* Latest log */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted"><Loader2 size={16} className="animate-spin" /> Loading...</div>
      ) : log ? (
        <div className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Latest Run</h2>
            <div className="flex items-center gap-2">
              {log.status === 'running' && <Loader2 size={13} className="animate-spin text-accent-2" />}
              <span className={cn('text-xs font-semibold uppercase', statusColor(log.status))}>
                {log.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: log.total_papers },
              { label: 'Scored', value: log.scored_papers },
              { label: 'Duplicates', value: log.duplicates_removed },
              { label: 'Errors', value: log.errors },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-2 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-white">{value ?? 0}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar (shown when running or complete) */}
          {(log.total_papers ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted">
                <span className="font-medium text-white">Scoring progress</span>
                <span>{(log.scored_papers ?? 0).toLocaleString()} / {(log.total_papers ?? 0).toLocaleString()} papers</span>
              </div>
              <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, ((log.scored_papers ?? 0) / (log.total_papers ?? 1)) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted">
                {log.status === 'running'
                  ? `⏳ Scoring papers… ${Math.round(((log.scored_papers ?? 0) / (log.total_papers ?? 1)) * 100)}% done`
                  : log.status === 'complete'
                  ? `✅ Scored ${(log.scored_papers ?? 0).toLocaleString()} papers successfully`
                  : ''}
              </p>
            </div>
          )}

          {/* Pipeline steps indicator */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted">Pipeline Steps</p>
            {[
              { step: '1. Inspect database',      done: (log.total_papers ?? 0) > 0 },
              { step: '2. Deduplicate papers',    done: log.status !== 'running' && (log.duplicates_removed ?? 0) >= 0 },
              { step: '3. Score papers (AI+TF-IDF)', done: (log.scored_papers ?? 0) > 0 },
              { step: '4. Normalize scores',      done: log.status === 'complete' },
              { step: '5. Assign trend labels',   done: log.status === 'complete' },
            ].map(({ step, done }) => (
              <div key={step} className="flex items-center gap-2 text-xs">
                <div className={cn('w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[10px]',
                  done ? 'bg-success/20 text-success' : log.status === 'running' ? 'bg-accent/20 text-accent-2 animate-pulse' : 'bg-surface-3 text-muted'
                )}>
                  {done ? '✓' : '·'}
                </div>
                <span className={done ? 'text-slate-300' : 'text-muted'}>{step}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted">
            <div><span className="text-slate-500">Started:</span> {log.started_at ? new Date(log.started_at).toLocaleString() : '—'}</div>
            {log.finished_at && <div><span className="text-slate-500">Finished:</span> {new Date(log.finished_at).toLocaleString()}</div>}
            <div><span className="text-slate-500">Type:</span> {log.run_type}</div>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-accent/15 rounded-2xl p-8 text-center text-muted text-sm">
          No analysis runs yet
        </div>
      )}

      <SchedulerStatus />
    </div>
  )
}

// ── Papers ────────────────────────────────────────────────────────────────────

function PapersAdmin() {
  const [papers, setPapers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState('normalized_score')
  const [arxivId, setArxivId] = useState('')
  const [adding, setAdding] = useState(false)

  const loadPapers = (p = 0, sort = sortBy) => {
    setLoading(true)
    adminApi.getPapers(p, sort)
      .then((r) => { setPapers(r.data.papers || []); setPage(p) })
      .catch(() => toast.error('Failed to load papers'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPapers() }, [])

  const deletePaper = async (id: number) => {
    if (!confirm('Delete this paper?')) return
    try {
      await adminApi.deletePaper(id)
      toast.success('Deleted')
      loadPapers(page)
    } catch {
      toast.error('Delete failed')
    }
  }

  const addPaper = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!arxivId.trim()) return
    setAdding(true)
    try {
      await adminApi.addManualPaper(arxivId.trim())
      toast.success('Paper queued for processing!')
      setArxivId('')
    } catch {
      toast.error('Failed to add paper')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Papers</h1>

      {/* Add paper */}
      <form onSubmit={addPaper} className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Add Paper by arXiv ID</h2>
        <div className="flex gap-3">
          <input
            value={arxivId}
            onChange={(e) => setArxivId(e.target.value)}
            placeholder="e.g. 2401.12345"
            className="flex-1 bg-surface-2 border border-accent/20 rounded-xl py-2 px-4 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 transition-all"
          />
          <button
            type="submit"
            disabled={adding}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/80 disabled:opacity-50 transition-all"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>
      </form>

      {/* Sort controls */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted">Sort by:</span>
        {['normalized_score', 'current_score', 'view_count', 'citation_count'].map((s) => (
          <button
            key={s}
            onClick={() => { setSortBy(s); loadPapers(0, s) }}
            className={cn(
              'px-3 py-1 text-xs rounded-lg transition-all',
              sortBy === s ? 'bg-accent/20 text-accent-2 border border-accent/30' : 'text-muted hover:text-white hover:bg-white/5'
            )}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Papers table */}
      <div className="bg-surface border border-accent/15 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center text-muted"><Loader2 size={20} className="animate-spin" /></div>
        ) : papers.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">No papers found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-accent/10 text-xs text-muted">
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Category</th>
                  <th className="text-right px-4 py-3">Score</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Views</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {papers.map((p) => (
                  <tr key={p.id} className="border-b border-accent/5 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-white font-medium line-clamp-1">{p.title}</p>
                      <p className="text-xs text-muted">{p.arxiv_id}</p>
                    </td>
                    <td className="px-4 py-3 text-muted hidden sm:table-cell">{p.primary_category || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-accent-2">
                      {p.normalized_score != null ? (p.normalized_score * 100).toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-muted hidden sm:table-cell">{p.view_count ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deletePaper(p.id)}
                        className="p-1.5 text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3 justify-center">
        <button onClick={() => loadPapers(page - 1)} disabled={page === 0 || loading}
          className="px-4 py-2 bg-surface border border-accent/20 text-sm text-muted rounded-xl disabled:opacity-40 hover:bg-surface-2 transition-all">
          Previous
        </button>
        <span className="text-sm text-muted">Page {page + 1}</span>
        <button onClick={() => loadPapers(page + 1)} disabled={papers.length < 20 || loading}
          className="px-4 py-2 bg-surface border border-accent/20 text-sm text-muted rounded-xl disabled:opacity-40 hover:bg-surface-2 transition-all">
          Next
        </button>
      </div>
    </div>
  )
}

// ── Topic Categories (non-technical feed) ────────────────────────────────────

const TOPIC_COLORS = ['slate','blue','pink','orange','green','red','cyan','yellow','purple','emerald']

interface TopicCategory {
  key: string; emoji: string; label: string; tagline: string; hook: string
  color: string; paper_count: number; is_builtin: boolean; is_visible: boolean
}

function TopicsAdmin() {
  const [topics, setTopics] = useState<TopicCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ key: '', emoji: '', label: '', tagline: '', hook: '', color: 'slate' })
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    adminApi.getTopicCategories()
      .then(r => setTopics(r.data || []))
      .catch(() => toast.error('Failed to load topics'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const addTopic = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await adminApi.addTopicCategory(form)
      toast.success(`Topic "${form.label}" added!`)
      setForm({ key: '', emoji: '', label: '', tagline: '', hook: '', color: 'slate' })
      load()
    } catch {
      toast.error('Failed to add topic (key may already exist)')
    }
  }

  const deleteTopic = async (key: string, label: string, isBuiltin: boolean) => {
    const msg = isBuiltin
      ? `Hide "${label}" from the non-technical feed? (Can be restored later)`
      : `Permanently delete custom topic "${label}"?`
    if (!confirm(msg)) return
    try {
      await adminApi.deleteTopicCategory(key)
      toast.success(isBuiltin ? `"${label}" hidden` : `"${label}" deleted`)
      load()
    } catch {
      toast.error('Failed to delete topic')
    }
  }

  const restoreTopic = async (key: string, label: string) => {
    try {
      await adminApi.restoreTopicCategory(key)
      toast.success(`"${label}" restored`)
      load()
    } catch {
      toast.error('Failed to restore topic')
    }
  }

  const colorDot: Record<string, string> = {
    blue:'bg-blue-400', pink:'bg-pink-400', orange:'bg-orange-400', green:'bg-green-400',
    red:'bg-red-400', cyan:'bg-cyan-400', yellow:'bg-yellow-400', purple:'bg-purple-400',
    emerald:'bg-emerald-400', slate:'bg-slate-400',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Topic Categories</h1>
        <p className="text-sm text-muted mt-1">
          These are the non-technical categories shown to public readers — Medicine, Robotics, etc.
          Each category groups papers and shows a journalist narrative hook on the landing page.
        </p>
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total topics', value: topics.length },
            { label: 'Visible', value: topics.filter(t => t.is_visible).length },
            { label: 'Total papers classified', value: topics.reduce((s, t) => s + t.paper_count, 0).toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface border border-accent/15 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Topic list */}
      <div className="bg-surface border border-accent/15 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-accent/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">All Categories</h2>
          <span className="text-xs text-muted">{topics.filter(t => t.is_visible).length} visible / {topics.length} total</span>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-muted" /></div>
        ) : (
          <div className="divide-y divide-accent/5">
            {topics.map(t => (
              <div key={t.key} className={cn('transition-colors', !t.is_visible && 'opacity-40')}>
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 cursor-pointer"
                  onClick={() => setExpanded(expanded === t.key ? null : t.key)}
                >
                  <span className="text-xl w-7 text-center shrink-0">{t.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{t.label}</span>
                      {!t.is_builtin && (
                        <span className="text-[9px] bg-accent/15 text-accent-2 border border-accent/20 rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wide">custom</span>
                      )}
                      {!t.is_visible && (
                        <span className="text-[9px] bg-red-500/15 text-red-400 border border-red-500/20 rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wide">hidden</span>
                      )}
                    </div>
                    <p className="text-xs text-muted truncate">{t.tagline}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', colorDot[t.color] || 'bg-slate-400')} />
                    <span className="text-xs text-muted tabular-nums">{t.paper_count} papers</span>
                    {t.is_visible ? (
                      <button
                        onClick={e => { e.stopPropagation(); deleteTopic(t.key, t.label, t.is_builtin) }}
                        className="p-1.5 text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        title={t.is_builtin ? 'Hide from feed' : 'Delete'}
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); restoreTopic(t.key, t.label) }}
                        className="p-1.5 text-muted hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-all text-xs"
                        title="Restore"
                      >
                        ↩
                      </button>
                    )}
                  </div>
                </div>
                {/* Expandable hook preview */}
                {expanded === t.key && (
                  <div className="px-5 pb-4 pt-1 bg-surface-2 space-y-2">
                    <p className="text-xs text-muted font-semibold uppercase tracking-wide">Landing page hook</p>
                    <p className="text-sm text-white/80 leading-relaxed">{t.hook || <span className="text-muted italic">No hook set</span>}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add custom topic */}
      <form onSubmit={addTopic} className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Add Custom Topic</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <input value={form.key} onChange={e => setForm({ ...form, key: e.target.value })}
            placeholder="Key (e.g. Quantum)" required
            className="bg-surface-2 border border-accent/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50" />
          <input value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })}
            placeholder="Emoji (e.g. ⚛️)" required
            className="bg-surface-2 border border-accent/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50" />
          <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
            placeholder="Label (e.g. Quantum Computing)" required
            className="bg-surface-2 border border-accent/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50" />
          <input value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })}
            placeholder="Short tagline for the card" required
            className="col-span-2 bg-surface-2 border border-accent/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50" />
          <select value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
            className="bg-surface-2 border border-accent/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50">
            {TOPIC_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <textarea value={form.hook} onChange={e => setForm({ ...form, hook: e.target.value })}
          placeholder="Journalist narrative hook shown on the landing page (2-3 sentences, plain English)" required rows={3}
          className="w-full bg-surface-2 border border-accent/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50 resize-none" />
        <button type="submit"
          className="flex items-center gap-1.5 px-4 py-2 bg-accent/20 hover:bg-accent/30 border border-accent/30 text-accent-2 text-sm font-medium rounded-xl transition-all">
          <Plus size={14} /> Add Topic
        </button>
      </form>
    </div>
  )
}


// ── Topic Mapping — subjects & keywords grouped by topic ─────────────────────

function TopicMappingAdmin() {
  const [mapping, setMapping] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [openTopic, setOpenTopic] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)

  const load = () => {
    setLoading(true)
    adminApi.getTopicsMapping()
      .then(r => setMapping(r.data || {}))
      .catch(() => toast.error('Failed to load mapping'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const autoAssign = async () => {
    if (!confirm('Auto-assign all subjects and keywords to topics based on arXiv category rules? This will overwrite current assignments.')) return
    setAssigning(true)
    try {
      const r = await adminApi.autoAssignTopics()
      toast.success(`Done — ${r.data.subjects_updated} subjects, ${r.data.keywords_updated} keywords assigned`)
      load()
    } catch {
      toast.error('Auto-assign failed')
    } finally {
      setAssigning(false)
    }
  }

  const assignSubject = async (id: number, topic: string) => {
    try {
      await adminApi.setSubjectTopic(id, topic)
      toast.success('Subject moved')
      load()
    } catch { toast.error('Failed') }
  }

  const assignKeyword = async (id: number, topic: string) => {
    try {
      await adminApi.setKeywordTopic(id, topic)
      toast.success('Keyword moved')
      load()
    } catch { toast.error('Failed') }
  }

  const deleteSubject = async (id: number) => {
    if (!confirm('Delete this subject?')) return
    try {
      await adminApi.deleteSubject(id)
      toast.success('Deleted')
      load()
    } catch { toast.error('Failed') }
  }

  const deleteKeyword = async (id: number) => {
    try {
      await adminApi.deleteKeyword(id)
      toast.success('Deleted')
      load()
    } catch { toast.error('Failed') }
  }

  const topicKeys = Object.keys(mapping)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Subjects & Keywords by Topic</h1>
          <p className="text-sm text-muted mt-1">
            See which arXiv subjects and scoring keywords belong to each non-technical topic. Click a topic to expand, then reassign or delete items.
          </p>
        </div>
        <button
          onClick={autoAssign}
          disabled={assigning || loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-400 text-sm font-medium rounded-xl transition-all shrink-0 disabled:opacity-50"
        >
          {assigning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Auto-assign all
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-muted" /></div>
      ) : (
        <div className="space-y-3">
          {topicKeys.map(topicKey => {
            const t = mapping[topicKey]
            const isOpen = openTopic === topicKey
            const totalItems = (t.subjects?.length || 0) + (t.keywords?.length || 0)
            return (
              <div key={topicKey} className="bg-surface border border-accent/15 rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-2 transition-colors"
                  onClick={() => setOpenTopic(isOpen ? null : topicKey)}
                >
                  <span className="text-xl w-7 text-center shrink-0">{t.emoji}</span>
                  <span className="text-sm font-semibold text-white flex-1 text-left">{t.label}</span>
                  <span className="text-xs text-muted">
                    {t.subjects?.length || 0} subjects · {t.keywords?.length || 0} keywords
                  </span>
                  <span className="text-muted text-sm">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-accent/10 divide-y divide-accent/5">
                    {/* Subjects */}
                    <div className="px-5 py-3">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">arXiv Subjects</p>
                      {t.subjects?.length === 0 ? (
                        <p className="text-xs text-muted/40 italic">No subjects assigned</p>
                      ) : (
                        <div className="space-y-1">
                          {t.subjects.map((s: any) => (
                            <div key={s.id} className="flex items-center gap-2 text-xs">
                              <span className="font-mono text-accent-2 bg-accent/10 px-1.5 py-0.5 rounded">{s.subject_code}</span>
                              <span className="text-muted/60 flex-1 truncate">{s.description}</span>
                              <select
                                value={topicKey}
                                onChange={e => assignSubject(s.id, e.target.value)}
                                className="bg-surface-2 border border-accent/20 text-xs text-white rounded-lg px-2 py-1 focus:outline-none"
                              >
                                {topicKeys.map(tk => (
                                  <option key={tk} value={tk}>{mapping[tk]?.label || tk}</option>
                                ))}
                              </select>
                              <button onClick={() => deleteSubject(s.id)} className="text-muted hover:text-red-400 p-1 rounded transition-colors">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Keywords */}
                    <div className="px-5 py-3">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Scoring Keywords</p>
                      {t.keywords?.length === 0 ? (
                        <p className="text-xs text-muted/40 italic">No keywords assigned</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {t.keywords.map((k: any) => (
                            <div key={k.id} className="flex items-center gap-1 bg-surface-2 border border-accent/15 rounded-lg px-2 py-1">
                              <span className="text-xs text-white">{k.keyword}</span>
                              <span className="text-[9px] text-muted/50">×{k.weight}</span>
                              <select
                                value={topicKey}
                                onChange={e => assignKeyword(k.id, e.target.value)}
                                className="bg-transparent text-[10px] text-muted focus:outline-none ml-1"
                              >
                                {topicKeys.map(tk => (
                                  <option key={tk} value={tk}>{mapping[tk]?.label || tk}</option>
                                ))}
                              </select>
                              <button onClick={() => deleteKeyword(k.id)} className="text-muted hover:text-red-400 transition-colors ml-0.5">
                                <Trash2 size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ── Subjects ──────────────────────────────────────────────────────────────────

function SubjectsAdmin() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [form, setForm] = useState({ subject_code: '', description: '' })

  const load = () => {
    adminApi.getSubjects()
      .then((r) => setSubjects(r.data || []))
      .catch(() => toast.error('Failed to load subjects'))
  }

  useEffect(() => { load() }, [])

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await adminApi.addSubject(form.subject_code.trim(), form.description.trim())
      toast.success('Subject added!')
      setForm({ subject_code: '', description: '' })
      load()
    } catch {
      toast.error('Failed to add subject (may already exist)')
    }
  }

  const deleteSubject = async (id: number) => {
    try {
      await adminApi.deleteSubject(id)
      load()
    } catch {
      toast.error('Failed to delete subject')
    }
  }

  const toggleSubject = async (id: number) => {
    try {
      await adminApi.toggleSubject(id)
      load()
    } catch {
      toast.error('Failed to toggle subject')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">arXiv Subjects</h1>
        <p className="text-sm text-muted">Active subjects are used to fetch papers from arXiv daily. Toggle to include/exclude a category.</p>
      </div>

      <form onSubmit={addSubject} className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Add Subject</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={form.subject_code}
            onChange={(e) => setForm({ ...form, subject_code: e.target.value })}
            placeholder="e.g. cs.RO"
            className="bg-surface-2 border border-accent/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50"
            required
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (e.g. Robotics)"
            className="bg-surface-2 border border-accent/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50"
          />
        </div>
        <button type="submit" className="flex items-center gap-1.5 px-4 py-2 bg-accent/20 hover:bg-accent/30 border border-accent/30 text-accent-2 text-sm font-medium rounded-xl transition-all">
          <Plus size={14} /> Add Subject
        </button>
      </form>

      <div className="bg-surface border border-accent/15 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Subject Categories</h2>
          <span className="text-xs text-muted">{subjects.filter(s => s.is_active).length} active / {subjects.length} total</span>
        </div>
        {subjects.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">No subjects configured</div>
        ) : (
          <div className="space-y-2">
            {subjects.map((s) => (
              <div key={s.id} className={cn('flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 border transition-all', s.is_active ? 'bg-surface-2 border-accent/15' : 'bg-surface border-accent/8 opacity-50')}>
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.is_active ? 'bg-success' : 'bg-muted')} />
                  <span className="text-sm font-mono text-accent-2 font-semibold">{s.subject_code}</span>
                  <span className="text-xs text-muted">{s.description}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleSubject(s.id)}
                    className={cn('text-xs px-2 py-1 rounded-lg border transition-all', s.is_active ? 'bg-success/10 border-success/30 text-green-400 hover:bg-success/20' : 'bg-surface-3 border-accent/15 text-muted hover:text-white')}
                  >
                    {s.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => deleteSubject(s.id)} className="p-1.5 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-muted hover:text-red-400 rounded-lg transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Keywords ──────────────────────────────────────────────────────────────────

function KeywordsAdmin() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ keyword: '', weight: '1.0', category: 'general' })

  const loadKeywords = () => {
    adminApi.getKeywords()
      .then((r) => setKeywords(r.data || []))
      .catch(() => toast.error('Failed to load keywords'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadKeywords() }, [])

  const addKeyword = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await adminApi.addKeyword(form.keyword, parseFloat(form.weight), form.category)
      toast.success('Keyword added!')
      setForm({ keyword: '', weight: '1.0', category: 'general' })
      loadKeywords()
    } catch {
      toast.error('Failed to add keyword')
    }
  }

  const deleteKeyword = async (id: number) => {
    try {
      await adminApi.deleteKeyword(id)
      toast.success('Deleted')
      loadKeywords()
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Keywords</h1>
      <p className="text-sm text-muted">Keywords are used for TF-IDF scoring. Higher weight = more influence on score.</p>

      <form onSubmit={addKeyword} className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Add Keyword</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })}
            placeholder="e.g. transformer" required
            className="bg-surface-2 border border-accent/20 rounded-xl py-2 px-4 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 transition-all" />
          <div className="relative">
            <input type="number" step="0.1" min="0.1" max="3.0" value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              placeholder="Weight (0.1 – 3.0)"
              className="w-full bg-surface-2 border border-accent/20 rounded-xl py-2 px-4 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 transition-all" />
          </div>
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Category"
            className="bg-surface-2 border border-accent/20 rounded-xl py-2 px-4 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 transition-all" />
        </div>
        <button type="submit"
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/80 transition-all">
          <Plus size={14} /> Add Keyword
        </button>
      </form>

      <div className="bg-surface border border-accent/15 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-accent/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Active Keywords</h2>
          <span className="text-xs text-muted">{keywords.length} total</span>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-muted" /></div>
        ) : keywords.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">No keywords configured</div>
        ) : (
          <div className="divide-y divide-accent/5 max-h-96 overflow-y-auto">
            {keywords.map((kw) => (
              <div key={kw.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white font-medium">{kw.keyword}</span>
                  <span className="text-xs text-muted bg-surface-2 px-2 py-0.5 rounded-full">{kw.category}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-accent-2">×{kw.weight}</span>
                  <button onClick={() => deleteKeyword(kw.id)}
                    className="p-1.5 text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Users ─────────────────────────────────────────────────────────────────────

function UsersAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  const loadUsers = () => {
    adminApi.getUsers()
      .then((r) => setUsers(r.data || []))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, [])

  const toggleRole = async (user: AdminUser) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    if (!confirm(`Change ${user.email} to ${newRole}?`)) return
    try {
      await adminApi.updateUserRole(user.id, newRole)
      toast.success('Role updated')
      loadUsers()
    } catch {
      toast.error('Failed to update role')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Users</h1>

      <div className="bg-surface border border-accent/15 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-accent/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Registered Users</h2>
          <span className="text-xs text-muted">{users.length} total</span>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-muted" /></div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-accent/10 text-xs text-muted">
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Username</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Joined</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-accent/5 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 text-white">{u.email}</td>
                    <td className="px-4 py-3 text-muted hidden sm:table-cell">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full font-medium',
                        u.role === 'admin' ? 'bg-accent/20 text-accent-2' : 'bg-surface-2 text-muted'
                      )}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs hidden sm:table-cell">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleRole(u)}
                        className="p-1.5 text-muted hover:text-accent-2 hover:bg-accent/10 rounded-lg transition-all"
                        title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                      >
                        {u.role === 'admin' ? <ShieldOff size={13} /> : <Shield size={13} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dataset Summary card (used inside Config tab) ─────────────────────────────

function DatasetSummary() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getDatasetSummary()
      .then((r) => setSummary(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="bg-surface border border-accent/15 rounded-2xl p-5 flex items-center gap-2 text-muted text-sm">
      <Loader2 size={14} className="animate-spin" /> Loading dataset summary…
    </div>
  )
  if (!summary) return null

  const stats = [
    { label: 'Total Papers',    value: summary.total,          color: 'text-accent-2',   bg: 'bg-accent/8'     },
    { label: 'Scored',          value: summary.scored,         color: 'text-purple-400', bg: 'bg-purple-500/8' },
    { label: 'Unscored',        value: summary.unscored,       color: 'text-red-400',    bg: 'bg-red-500/8'    },
    { label: 'Above Threshold', value: summary.above_threshold,color: 'text-success',    bg: 'bg-success/8'    },
    { label: 'Trending 🔥',     value: summary.trending,       color: 'text-orange-400', bg: 'bg-orange-500/8' },
    { label: 'Enriched',        value: summary.enriched,       color: 'text-cyan-400',   bg: 'bg-cyan-500/8'   },
    { label: 'AI Validated',    value: summary.ai_validated,   color: 'text-pink-400',   bg: 'bg-pink-500/8'   },
    { label: 'With Citations',  value: summary.with_citations, color: 'text-yellow-400', bg: 'bg-yellow-500/8' },
    { label: 'With GitHub ⭐',  value: summary.with_github,    color: 'text-green-400',  bg: 'bg-green-500/8'  },
    { label: 'Stale (2w)',      value: summary.stale_2w,       color: 'text-slate-400',  bg: 'bg-slate-500/8'  },
    { label: 'Duplicates',      value: summary.duplicates,     color: 'text-muted',      bg: 'bg-surface-3'    },
    { label: 'Deleted',         value: summary.deleted,        color: 'text-muted',      bg: 'bg-surface-3'    },
  ]

  return (
    <div className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-5">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <Database size={14} className="text-accent-2" /> Dataset Overview
      </h2>

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl p-3 ${bg} border border-white/5`}>
            <p className={`text-xl font-bold tabular-nums ${color}`}>{(value ?? 0).toLocaleString()}</p>
            <p className="text-xs text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress bars */}
      <div className="space-y-2">
        {[
          { label: 'Score coverage', pct: summary.score_coverage_pct ?? 0, color: 'bg-purple-400' },
          { label: 'Feed visibility', pct: summary.visibility_pct ?? 0,     color: 'bg-success'    },
          { label: 'Enrichment rate', pct: summary.enrichment_pct ?? 0,     color: 'bg-cyan-400'   },
        ].map(({ label, pct, color }) => (
          <div key={label} className="flex items-center gap-3">
            <p className="text-xs text-muted w-32 shrink-0">{label}</p>
            <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-mono text-white w-10 text-right shrink-0">{pct}%</span>
          </div>
        ))}
      </div>

      {/* Trend breakdown */}
      {summary.trend_breakdown?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted mb-2">Trend Labels</p>
          <div className="flex flex-wrap gap-2">
            {summary.trend_breakdown.map((t: any) => (
              <span key={t.trend_label} className="text-xs px-3 py-1 bg-surface-2 border border-accent/15 rounded-full text-slate-300">
                {t.trend_label} <span className="font-bold text-accent-2">{t.cnt}</span>
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ── Config ────────────────────────────────────────────────────────────────────

function ConfigAdmin() {
  const [config, setConfig] = useState<ConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    adminApi.getConfig()
      .then((r) => setConfig(r.data || []))
      .catch(() => toast.error('Failed to load config'))
      .finally(() => setLoading(false))
  }, [])

  const save = async (key: string) => {
    setSaving(key)
    try {
      await adminApi.updateConfig(key, editing[key])
      toast.success('Saved!')
      setConfig((prev) => prev.map((c) => c.key === key ? { ...c, value: editing[key] } : c))
      setEditing((e) => { const n = { ...e }; delete n[key]; return n })
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Configuration</h1>
      <p className="text-sm text-muted">Edit scoring weights, API URLs, and system parameters. Changes take effect on next run.</p>

      <DatasetSummary />

      <div className="bg-surface border border-accent/15 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-muted" /></div>
        ) : config.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">No configuration found</div>
        ) : (
          <div className="divide-y divide-accent/5">
            {config.filter((item) => item.key !== 'OPENROUTER_API_URL').map((item) => (
              <div key={item.key} className="px-5 py-4 space-y-2">
                <div>
                  <p className="text-sm font-medium text-white font-mono">{item.key}</p>
                  <p className="text-xs text-muted">{item.description}</p>
                </div>
                <div className="flex gap-3">
                  <input
                    value={editing[item.key] ?? item.value}
                    onChange={(e) => setEditing({ ...editing, [item.key]: e.target.value })}
                    className="flex-1 bg-surface-2 border border-accent/20 rounded-xl py-2 px-3 text-sm text-white font-mono focus:outline-none focus:border-accent/50 transition-all"
                  />
                  {editing[item.key] !== undefined && editing[item.key] !== item.value && (
                    <button onClick={() => save(item.key)} disabled={saving === item.key}
                      className="px-3 py-2 bg-accent text-white text-xs font-medium rounded-xl hover:bg-accent/80 disabled:opacity-50 transition-all">
                      {saving === item.key ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Scheduler Status ──────────────────────────────────────────────────────────

function SchedulerStatus() {
  const [jobs, setJobs] = useState<any[]>([])
  const [currentWeek, setCurrentWeek] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    adminApi.getSchedulerStatus()
      .then((r) => {
        setJobs(r.data.jobs || [])
        setCurrentWeek(r.data.current_week ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const JOB_LABELS: Record<string, { label: string; color: string }> = {
    daily_fetch:              { label: 'Daily Fetch (8:00 AM IST / 2:30 AM UTC)',     color: 'text-cyan-400'   },
    weekly_rescore:           { label: 'Weekly Rescore (Sun 2:00 AM UTC)',             color: 'text-purple-400' },
    weekly_content_transition:{ label: 'Content Transition (Tue 00:05 UTC)',           color: 'text-orange-400' },
    enrich_pending:           { label: 'Enrich Papers (every hour)',                   color: 'text-green-400'  },
    daily_hooks:              { label: 'Hook Generation (3:15 AM UTC)',                color: 'text-yellow-400' },
    hourly_fetch_catchup:     { label: 'Fetch Catch-up (every hour at :35)',           color: 'text-slate-400'  },
    social_signals:           { label: 'Social Signals (every 4h · HF/HN/OpenAlex)', color: 'text-pink-400'   },
  }

  const formatNext = (iso: string | null) => {
    if (!iso) return 'N/A'
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }) + ' IST'
  }

  return (
    <div className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Scheduler Status</h2>
        <div className="flex items-center gap-3">
          {currentWeek !== null && (
            <span className="text-xs text-muted">Content Week <span className="text-accent-2 font-bold">{currentWeek}</span></span>
          )}
          <button onClick={load} className="p-1.5 hover:bg-white/5 rounded-lg transition-all">
            <RefreshCw size={12} className="text-muted hover:text-white" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted text-xs"><Loader2 size={12} className="animate-spin" /> Loading…</div>
      ) : jobs.length === 0 ? (
        <p className="text-xs text-muted">No scheduled jobs found.</p>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const meta = JOB_LABELS[job.id] || { label: job.name || job.id, color: 'text-muted' }
            return (
              <div key={job.id} className="flex items-center justify-between gap-3 bg-surface-2 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                  <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                </div>
                <span className="text-xs text-muted font-mono">next: {formatNext(job.next_run)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── SocialSignalsCard ─────────────────────────────────────────────────────────

function SocialSignalsCard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  const load = () => {
    setLoading(true)
    adminApi.getSocialSignals()
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleTrigger = async () => {
    setTriggering(true)
    try {
      await adminApi.triggerSocialSignals(200)
      toast.success('Social signal refresh started (200 papers)')
    } catch {
      toast.error('Failed to start refresh')
    } finally {
      setTriggering(false)
    }
  }

  const toIST = (s: string | null) => {
    if (!s) return '—'
    return new Date(s).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }) + ' IST'
  }

  if (loading) return (
    <div className="bg-surface border border-accent/15 rounded-2xl px-5 py-6 flex items-center gap-2 text-muted text-sm">
      <Loader2 size={14} className="animate-spin" /> Loading social signals…
    </div>
  )
  if (!data) return null

  const bars = [
    { label: 'HuggingFace upvotes', value: data.with_hf_data, pct: data.hf_pct, color: 'bg-yellow-400' },
    { label: 'HackerNews discussion', value: data.with_hn_data, pct: data.hn_pct, color: 'bg-orange-400' },
    { label: 'Citation velocity', value: data.with_velocity, pct: data.vel_pct, color: 'bg-purple-400' },
  ]

  return (
    <div className="bg-surface border border-accent/15 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-accent/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-accent-2" />
          <h2 className="text-sm font-semibold text-white">Social Signals</h2>
          <span className="text-xs text-muted bg-surface-2 border border-accent/10 px-2 py-0.5 rounded-full">
            {data.checked.toLocaleString()} checked
          </span>
        </div>
        <div className="flex items-center gap-2">
          {(data.unchecked ?? 0) > 0 && (
            <button
              onClick={handleTrigger} disabled={triggering}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-accent-2/10 border border-accent-2/30 text-accent-2 rounded-lg hover:bg-accent-2/20 disabled:opacity-50 transition-all"
            >
              {triggering ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              Refresh {data.unchecked} papers
            </button>
          )}
          <button onClick={load} className="text-xs text-muted hover:text-white flex items-center gap-1 transition-colors">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="space-y-2.5">
          {bars.map(({ label, value, pct, color }) => (
            <div key={label} className="flex items-center gap-3">
              <p className="text-xs text-muted w-44 shrink-0">{label}</p>
              <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-mono text-white w-24 text-right shrink-0 tabular-nums">
                {value.toLocaleString()} <span className="text-muted">({pct}%)</span>
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted">Last refreshed: <span className="text-white">{toIST(data.last_refresh)}</span></p>

        {/* Top HuggingFace */}
        {data.top_hf?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
              <Star size={11} className="text-yellow-400" /> Top by HuggingFace Upvotes
            </p>
            <div className="space-y-1">
              {data.top_hf.map((p: any) => (
                <div key={p.arxiv_id} className="flex items-center justify-between gap-3 text-xs">
                  <p className="text-white line-clamp-1 flex-1">{p.title}</p>
                  <span className="text-yellow-400 font-bold shrink-0 tabular-nums">{p.hf_upvotes} ▲</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top HackerNews */}
        {data.top_hn?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
              <Activity size={11} className="text-orange-400" /> Top HackerNews Discussion
            </p>
            <div className="space-y-1">
              {data.top_hn.map((p: any) => (
                <div key={p.arxiv_id} className="flex items-center justify-between gap-3 text-xs">
                  <p className="text-white line-clamp-1 flex-1">{p.title}</p>
                  <span className="text-orange-400 font-bold shrink-0 tabular-nums">
                    {p.hn_points}pts · {p.hn_comments}c
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.with_any_signal === 0 && (
          <p className="text-xs text-muted">No social signals collected yet. Social signal refresh runs every 4 hours automatically.</p>
        )}
      </div>
    </div>
  )
}

// ── ServiceConfigCard ─────────────────────────────────────────────────────────

function ServiceConfigCard() {
  const [configs, setConfigs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getServiceConfig()
      .then((r) => setConfigs(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const serviceColors: Record<string, string> = {
    Turso: 'text-blue-400',
    Auth:  'text-yellow-400',
    Redis: 'text-red-400',
    CORS:  'text-slate-400',
  }

  return (
    <div className="bg-surface border border-accent/15 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-accent/10 flex items-center gap-2">
        <Shield size={15} className="text-accent-2" />
        <h2 className="text-sm font-semibold text-white">Environment Configuration</h2>
        <span className="text-xs text-muted ml-auto">Credentials are masked — set via .env / Render dashboard</span>
      </div>

      {loading ? (
        <div className="px-5 py-6 flex items-center gap-2 text-muted text-sm">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="divide-y divide-accent/5">
          {configs.map((cfg) => (
            <div key={cfg.key} className="px-5 py-3 flex items-start gap-3">
              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.set ? 'bg-green-400' : cfg.required ? 'bg-red-400 animate-pulse' : 'bg-slate-600'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-white">{cfg.key}</span>
                  <span className={`text-xs font-medium ${serviceColors[cfg.service] ?? 'text-slate-400'}`}>{cfg.service}</span>
                  {cfg.set ? (
                    <span className="text-xs text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">set</span>
                  ) : cfg.required ? (
                    <span className="text-xs text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">missing — required</span>
                  ) : (
                    <span className="text-xs text-slate-500 bg-surface-3 px-1.5 py-0.5 rounded-full">not set (optional)</span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">{cfg.description}</p>
                {cfg.preview && (
                  <p className="text-xs font-mono text-slate-500 mt-0.5">{cfg.preview}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── APIs & Enrichment ─────────────────────────────────────────────────────────

function ApisAdmin() {
  const [healthLoading, setHealthLoading] = useState(false)
  const [results, setResults] = useState<Record<string, { ok: boolean; status: number; latency_ms: number; error?: string; detail?: string } | null>>({})
  const [configMap, setConfigMap] = useState<Record<string, string>>({})

  // Load editable config values (API URLs stored in admin_config)
  useEffect(() => {
    adminApi.getConfig()
      .then((r) => {
        const map: Record<string, string> = {}
        for (const item of (r.data || [])) map[item.key] = item.value
        setConfigMap(map)
      })
      .catch(() => {})
  }, [])

  const [testingApi, setTestingApi] = useState<string | null>(null)

  const testAllApis = async () => {
    setHealthLoading(true)
    try {
      const res = await adminApi.getApiHealth()
      setResults(res.data || {})
    } catch {
      toast.error('Health check failed')
    } finally {
      setHealthLoading(false)
    }
  }

  const testSingleApi = async (name: string) => {
    setTestingApi(name)
    try {
      const res = await adminApi.getApiHealth()
      setResults((prev) => ({ ...prev, [name]: (res.data || {})[name] ?? null }))
    } catch {
      toast.error('Test failed')
    } finally {
      setTestingApi(null)
    }
  }

  // All 9 external services — configKey links to admin_config for live URL display
  const apis = [
    // ── Fetch ────────────────────────────────────────────────────────────────
    {
      name: 'ArXiv API',
      configKey: 'ARXIV_API_URL',
      description: 'Fetches new AI/ML research papers daily. Free, no auth required.',
      defaultUrl: 'http://export.arxiv.org/api/query',
      docsUrl: 'https://info.arxiv.org/help/api/',
      rateLimit: '3 s delay between pages',
      auth: 'None',
      icon: Database,
      color: 'text-cyan-400', border: 'border-cyan-500/20', bg: 'bg-cyan-500/8',
      category: 'Fetch',
    },
    // ── Enrich ───────────────────────────────────────────────────────────────
    {
      name: 'Semantic Scholar',
      configKey: 'SEMANTIC_SCHOLAR_API_URL',
      description: 'Batch citation counts, influential citation counts, and author h-indices.',
      defaultUrl: 'https://api.semanticscholar.org/graph/v1',
      docsUrl: 'https://api.semanticscholar.org/api-docs/',
      rateLimit: '100 req / 5 min (free tier)',
      auth: 'None (public)',
      icon: Brain,
      color: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/8',
      category: 'Enrich',
    },
    {
      name: 'Papers with Code',
      configKey: 'PAPERS_WITH_CODE_API_URL',
      description: 'Maps arXiv IDs to GitHub repo URLs. Used for URL discovery only — GitHub API fetches the live star count.',
      defaultUrl: 'https://paperswithcode.com/api/v1',
      docsUrl: 'https://paperswithcode.com/api/v1/docs/',
      rateLimit: '5 concurrent, 300 ms slots',
      auth: 'None',
      icon: Zap,
      color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/8',
      category: 'Enrich',
    },
    {
      name: 'GitHub API',
      configKey: 'GITHUB_API_URL',
      description: 'Fetches real-time star + fork counts for paper repos. 60 req/h unauthenticated — set GITHUB_API_TOKEN in env for 5000 req/h.',
      defaultUrl: 'https://api.github.com',
      docsUrl: 'https://docs.github.com/en/rest/repos/repos#get-a-repository',
      rateLimit: '60/h (no token) · 5000/h (with token)',
      auth: 'Optional: GITHUB_API_TOKEN env var',
      icon: Zap,
      color: 'text-slate-300', border: 'border-slate-500/20', bg: 'bg-slate-500/8',
      category: 'Enrich',
    },
    // ── Social ───────────────────────────────────────────────────────────────
    {
      name: 'HuggingFace Papers',
      configKey: 'HUGGINGFACE_API_URL',
      description: 'Community upvotes per paper. Feeds the trending_score — viral HF papers surface faster.',
      defaultUrl: 'https://huggingface.co/api/papers',
      docsUrl: 'https://huggingface.co/papers',
      rateLimit: '50 ms delay, 3 concurrent',
      auth: 'None',
      icon: TrendingUp,
      color: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/8',
      category: 'Social',
    },
    {
      name: 'HackerNews Algolia',
      configKey: 'HACKERNEWS_API_URL',
      description: 'Searches HN stories mentioning the paper. Points + comments contribute to trending_score.',
      defaultUrl: 'https://hn.algolia.com/api/v1',
      docsUrl: 'https://hn.algolia.com/api',
      rateLimit: '50 ms delay, 3 concurrent',
      auth: 'None',
      icon: Activity,
      color: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/8',
      category: 'Social',
    },
    {
      name: 'OpenAlex',
      configKey: 'OPENALEX_API_URL',
      description: 'Free scholarly metadata for citation velocity (year-over-year citation growth rate).',
      defaultUrl: 'https://api.openalex.org',
      docsUrl: 'https://docs.openalex.org/',
      rateLimit: '10 req/s polite pool, 120 ms delay',
      auth: 'None (email in User-Agent)',
      icon: BookOpen,
      color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/8',
      category: 'Social',
    },
    // ── Infrastructure ───────────────────────────────────────────────────────
    {
      name: 'Turso',
      configKey: null,
      description: 'Primary database — libSQL / SQLite edge DB. Stores all papers, scores, config, logs, author cache.',
      defaultUrl: '*.turso.io  (set via TURSO_DATABASE_URL)',
      docsUrl: 'https://docs.turso.tech/',
      rateLimit: 'Plan-based row/request limits',
      auth: 'JWT token (TURSO_AUTH_TOKEN)',
      icon: Database,
      color: 'text-sky-400', border: 'border-sky-500/20', bg: 'bg-sky-500/8',
      category: 'Infrastructure',
    },
  ]

  const categoryMeta: Record<string, { label: string; color: string; desc: string }> = {
    Fetch:          { label: 'Fetch',          color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',     desc: 'Paper ingestion' },
    Enrich:         { label: 'Enrich',         color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', desc: 'Citation & GitHub data' },
    Social:         { label: 'Social Signals', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', desc: 'Community engagement' },
    AI:             { label: 'AI / LLM',       color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',     desc: 'Scoring & hooks' },
    Infrastructure: { label: 'Infrastructure', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         desc: 'Storage & cache' },
  }

  const healthResult = (name: string) => results[name]

  const StatusBadge = ({ name }: { name: string }) => {
    const r = healthResult(name)
    if (healthLoading) return <Loader2 size={12} className="animate-spin text-muted" />
    if (!r) return <span className="text-xs text-muted">—</span>
    if (r.ok) return (
      <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-1.5 py-0.5 rounded-full">
        <CheckCircle size={10} /> {r.detail || `${r.status} · ${r.latency_ms}ms`}
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded-full">
        <WifiOff size={10} /> {r.status || 'unreachable'}{r.error ? ` · ${r.error}` : ''}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">APIs & Third-Party Services</h1>
          <p className="text-sm text-muted mt-1">
            Every external service this system depends on — 7 total across 4 categories.
          </p>
        </div>
        <button
          onClick={testAllApis} disabled={healthLoading}
          className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 text-accent rounded-xl text-sm hover:bg-accent/20 disabled:opacity-50 transition-all shrink-0"
        >
          {healthLoading ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
          {healthLoading ? 'Checking…' : 'Check All'}
        </button>
      </div>

      {/* API cards grouped by category */}
      {(['Fetch', 'Enrich', 'Social', 'Infrastructure'] as const).map((cat) => {
        const meta = categoryMeta[cat]
        const catApis = apis.filter((a) => a.category === cat)
        return (
          <div key={cat} className="space-y-3">
            {/* Category header */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${meta.color}`}>{meta.label}</span>
              <span className="text-xs text-muted">{meta.desc}</span>
              <div className="h-px flex-1 bg-accent/10" />
            </div>

            {catApis.map(({ name, configKey, description, defaultUrl, docsUrl, rateLimit, auth, icon: Icon, color, border, bg }) => {
              // Use the live config value from DB if available, else fall back to hardcoded default
              const liveUrl = configKey && configMap[configKey] ? configMap[configKey] : defaultUrl
              const isFromConfig = configKey && !!configMap[configKey]

              return (
                <div key={name} className={`bg-surface border ${border} rounded-2xl p-4`}>
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl ${bg} border ${border} flex items-center justify-center shrink-0`}>
                      <Icon size={16} className={color} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white">{name}</h3>
                        {configKey && (
                          <span className="text-xs font-mono text-slate-500 bg-surface-2 border border-accent/10 px-1.5 py-0.5 rounded">
                            {configKey}
                          </span>
                        )}
                        <StatusBadge name={name} />
                        <div className="ml-auto flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => testSingleApi(name)}
                            disabled={testingApi === name || healthLoading}
                            className="text-xs px-2 py-0.5 bg-accent/10 border border-accent/20 text-accent rounded-lg hover:bg-accent/20 disabled:opacity-50 transition-all flex items-center gap-1"
                          >
                            {testingApi === name ? <Loader2 size={10} className="animate-spin" /> : <Wifi size={10} />}
                            Test
                          </button>
                          <a
                            href={docsUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-muted hover:text-accent-2 transition-colors"
                          >
                            Docs ↗
                          </a>
                        </div>
                      </div>
                      <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>

                      {/* URL row — shows live config value */}
                      <div className="mt-2 flex items-center gap-2 bg-surface-2 border border-accent/10 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs font-mono text-slate-300 truncate flex-1">{liveUrl}</span>
                        {isFromConfig && (
                          <span className="text-xs text-green-500 shrink-0">from config</span>
                        )}
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={10} /> {rateLimit}
                        </span>
                        <span className={`text-xs flex items-center gap-1 ${auth === 'None' || auth.startsWith('None') ? 'text-green-500' : 'text-yellow-500'}`}>
                          {auth === 'None' || auth.startsWith('None') ? <ShieldOff size={10} /> : <Shield size={10} />}
                          {auth}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Social signals coverage */}
      <SocialSignalsCard />

      {/* Environment config */}
      <ServiceConfigCard />

      {/* Scheduler */}
      <SchedulerStatus />

      {/* Pipeline overview */}
      <div className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Pipeline Overview</h2>
        <div className="space-y-2 text-xs text-muted">
          {[
            ['1. Fetch',   'ArXiv API → new AI/ML papers daily at 8:00 AM IST'],
            ['2. Enrich',  'Semantic Scholar (citations + h-index) · Papers with Code (GitHub stars)'],
            ['3. Score',   'TF-IDF keyword + Gemini Flash Lite (via OpenRouter) AI validation → current_score'],
            ['4. Social',  'HuggingFace · HackerNews · OpenAlex → trending/rising/gem scores (every 4h)'],
            ['5. Rank',    'Normalize globally (0–1) · assign trend labels using quality + social signals'],
            ['6. Cache',   'Redis caches feed responses (5 min TTL) to reduce Turso DB load'],
            ['7. Serve',   'Feed API → Trending / Rising / Hidden Gems / Top Picks sections'],
          ].map(([step, desc]) => (
            <div key={step} className="flex gap-3">
              <span className="text-accent-2 font-semibold shrink-0 w-16">{step}</span>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Paper Quality Check ───────────────────────────────────────────────────────

function ScoreBar({ label, value, color = 'accent' }: { label: string; value: number; color?: string }) {
  const pct = Math.round(value * 100)
  const colorMap: Record<string, string> = {
    accent: 'bg-accent',
    teal: 'bg-teal-500',
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-500',
    sky: 'bg-sky-500',
    green: 'bg-green-500',
  }
  const bar = colorMap[color] ?? 'bg-accent'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-white tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
        <div className={`h-full ${bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SignalBadge({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 bg-surface-2 rounded-xl px-3 py-2.5">
      <span className="text-muted shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-white truncate">{value}</p>
      </div>
    </div>
  )
}

function PaperQualityCheck() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res: any = await adminApi.paperQualityCheck(input.trim())
      setResult(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Something went wrong. Check the arXiv ID and try again.')
    } finally {
      setLoading(false)
    }
  }

  const addToDatabase = async () => {
    if (!result) return
    setSaving(true)
    try {
      await adminApi.paperQualitySave(result.paper, result.signals, result.scores)
      setResult((prev: any) => ({ ...prev, in_database: true }))
      toast.success('Paper added to database with all scores!')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to save paper')
    } finally {
      setSaving(false)
    }
  }

  const paper   = result?.paper
  const signals = result?.signals
  const scores  = result?.scores
  const verdict = result?.verdict

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Paper Quality Check</h1>
        <p className="text-sm text-muted mt-1">Enter an arXiv link or ID to run all scoring signals and get a full quality breakdown.</p>
      </div>

      {/* Input */}
      <form onSubmit={run} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="https://arxiv.org/abs/2301.00001  or  2301.00001"
          className="flex-1 bg-surface border border-accent/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent/20 border border-accent/30 text-accent-2 text-sm font-semibold rounded-xl hover:bg-accent/30 disabled:opacity-50 transition-all"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          {loading ? 'Checking…' : 'Check Paper'}
        </button>
      </form>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">{error}</div>
      )}

      {loading && (
        <div className="bg-surface border border-accent/15 rounded-2xl p-8 flex flex-col items-center gap-3 text-muted">
          <Loader2 size={28} className="animate-spin text-accent-2" />
          <p className="text-sm">Fetching from arXiv · querying Semantic Scholar · HuggingFace · HackerNews · OpenAlex · GitHub · running AI validation…</p>
        </div>
      )}

      {result && (
        <div className="space-y-5">

          {/* Paper header */}
          <div className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <h2 className="text-base font-bold text-white leading-snug">{paper.title}</h2>
                <p className="text-xs text-muted">
                  {paper.primary_category} · {paper.authors?.slice(0, 3).map((a: any) => a.name ?? a).join(', ')}
                  {paper.authors?.length > 3 ? ` +${paper.authors.length - 3} more` : ''}
                </p>
                <p className="text-xs text-muted">
                  Published {verdict.age_days < 1 ? 'today' : `${verdict.age_days}d ago`}
                  {paper.published_at ? ` · ${new Date(paper.published_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <a
                  href={paper.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-accent-2 hover:underline"
                >
                  <ExternalLink size={13} /> arXiv
                </a>
                {result.in_database ? (
                  <span className="flex items-center gap-1.5 text-xs bg-green-500/15 text-green-400 border border-green-500/25 px-2.5 py-1 rounded-full font-medium">
                    <CheckCircle size={12} /> In Database
                  </span>
                ) : (
                  <button
                    onClick={addToDatabase}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-xs bg-accent/15 text-accent-2 border border-accent/30 px-3 py-1.5 rounded-full font-semibold hover:bg-accent/25 disabled:opacity-50 transition-all"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    {saving ? 'Adding…' : 'Add to Database'}
                  </button>
                )}
              </div>
            </div>
            {signals.ai_summary && (
              <p className="text-xs text-slate-300 leading-relaxed border-t border-accent/10 pt-3">{signals.ai_summary}</p>
            )}
            {signals.ai_topic_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {signals.ai_topic_tags.map((t: string) => (
                  <span key={t} className="text-[11px] bg-accent/10 text-accent-2 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Verdict banner */}
          <div className={cn(
            'rounded-2xl p-4 border flex items-center gap-4',
            verdict.quality === 'High'   ? 'bg-green-500/8 border-green-500/25' :
            verdict.quality === 'Medium' ? 'bg-amber-500/8 border-amber-500/25' :
                                           'bg-surface border-accent/15'
          )}>
            <div className="text-3xl leading-none">
              {verdict.trend_label ? verdict.trend_label.split(' ')[0] : verdict.quality === 'High' ? '✅' : verdict.quality === 'Medium' ? '🔶' : '⬜'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">
                {verdict.trend_label ?? `${verdict.quality} Quality`}
                {signals.is_ai_relevant && <span className="ml-2 text-[11px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-medium">AI Relevant</span>}
              </p>
              <p className="text-xs text-muted mt-0.5">
                Overall score <span className="text-white font-semibold">{Math.round(scores.blended_score * 100)}%</span>
                {verdict.has_code && <span className="ml-2">· has code repo</span>}
                {verdict.has_social_buzz && <span className="ml-2">· community buzz</span>}
                {verdict.is_trending && <span className="ml-2 text-orange-400">· trending now</span>}
                {verdict.is_rising && !verdict.is_trending && <span className="ml-2 text-sky-400">· rising</span>}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-black text-white tabular-nums">{Math.round(scores.blended_score * 100)}<span className="text-sm font-normal text-muted">/100</span></p>
              <p className="text-[11px] text-muted capitalize">{scores.score_type} paper</p>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Score Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              <ScoreBar label="Base Score"      value={scores.base_score}      color="accent"  />
              <ScoreBar label="Trending Score"  value={scores.trending_score}  color="rose"    />
              <ScoreBar label="Rising Score"    value={scores.rising_score}    color="sky"     />
              <ScoreBar label="Gem Score"       value={scores.gem_score}       color="amber"   />
              <ScoreBar label="AI Relevance"    value={signals.ai_relevance_score} color="purple" />
              <ScoreBar label="AI Impact"       value={signals.ai_impact_score}    color="teal"   />
            </div>
          </div>

          {/* Raw signals */}
          <div className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Raw Signals</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <SignalBadge label="HF Upvotes"       value={signals.hf_upvotes.toLocaleString()}            icon={<Star size={14} />} />
              <SignalBadge label="HN Points"        value={signals.hn_points.toLocaleString()}             icon={<TrendingUp size={14} />} />
              <SignalBadge label="HN Comments"      value={signals.hn_comments.toLocaleString()}           icon={<MessageSquare size={14} />} />
              <SignalBadge label="Citations"        value={signals.citation_count.toLocaleString()}        icon={<BookOpen size={14} />} />
              <SignalBadge label="Influential Cit." value={signals.influential_citation_count.toLocaleString()} icon={<Zap size={14} />} />
              <SignalBadge label="Cit. Velocity"    value={`${Math.round(signals.citation_velocity * 100)}%`}  icon={<Activity size={14} />} />
              <SignalBadge label="GitHub Stars"     value={signals.github_stars.toLocaleString()}          icon={<Github size={14} />} />
              <SignalBadge label="GitHub Forks"     value={signals.github_forks.toLocaleString()}          icon={<Github size={14} />} />
              <SignalBadge label="Max H-Index"      value={signals.h_index_max ?? '—'}                    icon={<Users size={14} />} />
              <SignalBadge label="OpenAlex Cit."    value={signals.openalex_citation_count.toLocaleString()} icon={<Database size={14} />} />
            </div>
            {signals.github_url && (
              <a href={signals.github_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:underline">
                <Github size={12} /> {signals.github_url}
              </a>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

// ── Editor Runs ───────────────────────────────────────────────────────────────

interface EditorRun {
  id: number
  run_timestamp: string
  candidate_pool_size: number
  selected_context_ids: string[]
}

function EditorRunsAdmin() {
  const [runs, setRuns] = useState<EditorRun[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    adminApi.getEditorRuns()
      .then(r => setRuns(r.data?.runs ?? []))
      .catch(() => toast.error('Failed to load editor runs'))
      .finally(() => setLoading(false))
  }, [])

  const totalPapers = runs.reduce((sum, r) => sum + (r.selected_context_ids?.length ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ListTree size={18} className="text-accent" />
          Editor Runs
        </h1>
        <p className="text-sm text-muted mt-1">
          Context traceability — the exact 150 arXiv IDs evaluated by the LLM each run
        </p>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Runs', value: runs.length },
            { label: 'Papers Evaluated', value: totalPapers.toLocaleString() },
            { label: 'Avg Pool Size', value: runs.length ? Math.round(runs.reduce((s, r) => s + (r.candidate_pool_size ?? 0), 0) / runs.length).toLocaleString() : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface border border-accent/15 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-accent/15 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-accent/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Run History</h2>
          <span className="text-xs text-muted">Last 50 runs</span>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 size={20} className="animate-spin text-muted" />
          </div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">No editor runs found.</div>
        ) : (
          <div className="divide-y divide-accent/5">
            {runs.map(run => {
              const isOpen = expandedId === run.id
              const ids = run.selected_context_ids ?? []
              return (
                <div key={run.id}>
                  {/* Row */}
                  <div className="flex items-center gap-4 px-5 py-3 hover:bg-surface-2 transition-colors">
                    {/* Run ID badge */}
                    <span className="shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                      #{run.id}
                    </span>

                    {/* Timestamp + pool */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{toIST(run.run_timestamp)}</p>
                      <p className="text-xs text-muted mt-0.5">
                        Pool: <span className="text-slate-300">{(run.candidate_pool_size ?? 0).toLocaleString()}</span>
                        <span className="mx-2 text-accent/30">·</span>
                        Context: <span className="text-slate-300">{ids.length} papers</span>
                      </p>
                    </div>

                    {/* Expand button */}
                    <button
                      onClick={() => setExpandedId(isOpen ? null : run.id)}
                      className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
                    >
                      {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      {isOpen ? 'Collapse' : 'View Papers'}
                    </button>
                  </div>

                  {/* Expanded: scrollable arXiv ID list */}
                  {isOpen && (
                    <div className="px-5 pb-4 bg-surface-2 border-t border-accent/10">
                      <p className="text-[10px] font-mono text-muted uppercase tracking-widest py-2.5">
                        {ids.length} arXiv IDs evaluated — Run #{run.id}
                      </p>
                      <div className="h-64 overflow-y-auto rounded-xl border border-accent/10 bg-background p-3 space-y-1 scrollbar-thin">
                        {ids.map((arxivId, idx) => (
                          <div key={arxivId} className="flex items-center gap-3 text-[11px] font-mono group">
                            <span className="text-accent/30 w-6 shrink-0 text-right">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <a
                              href={`https://arxiv.org/abs/${arxivId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-cyan-400 hover:underline transition-colors truncate"
                            >
                              {arxivId}
                            </a>
                            <ExternalLink
                              size={10}
                              className="shrink-0 text-muted/0 group-hover:text-cyan-400/50 transition-colors"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Admin Layout ──────────────────────────────────────────────────────────────

export function AdminPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-accent/10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-muted hover:text-white transition-colors">
            <ArrowLeft size={15} /> Back to Feed
          </button>
          <span className="text-white font-semibold text-sm ml-2">Admin Panel</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6">
        <AdminSidebar />
        <main className="flex-1 min-w-0">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="analysis" element={<AnalysisAdmin />} />
            <Route path="papers" element={<PapersAdmin />} />
            <Route path="keywords" element={<KeywordsAdmin />} />
            <Route path="topics" element={<TopicsAdmin />} />
            <Route path="mapping" element={<TopicMappingAdmin />} />
            <Route path="subjects" element={<SubjectsAdmin />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="config" element={<ConfigAdmin />} />
            <Route path="apis" element={<ApisAdmin />} />
            <Route path="quality-check" element={<PaperQualityCheck />} />
            <Route path="editor-runs" element={<EditorRunsAdmin />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
