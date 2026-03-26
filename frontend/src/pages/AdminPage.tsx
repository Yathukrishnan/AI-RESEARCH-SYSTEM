import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, FileText, Settings, Tag, RefreshCw, Plus, Trash2,
  Play, ArrowLeft, Database, TrendingUp, Brain, CheckCircle, Loader2,
  Activity, Users, Eye, Copy, Shield, ShieldOff, Wifi, WifiOff, Zap,
  Clock, BookOpen, Star, AlertTriangle, Download
} from 'lucide-react'
import { adminApi } from '@/lib/api'
import { AdminStats, ConfigItem, Keyword, AnalysisLog, AdminUser } from '@/lib/types'
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
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/config', label: 'Config', icon: Settings },
    { to: '/admin/apis', label: 'APIs', icon: Wifi },
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
          <span className="text-xs px-2 py-1 bg-surface-2 border border-accent/10 rounded-lg text-muted">
            <span className="text-white font-medium">{data.pending.toLocaleString()}</span> pending enrichment
          </span>
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

  const load = () => {
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

      {/* Top categories */}
      {summary.top_categories?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted mb-2">Top Categories</p>
          <div className="flex flex-wrap gap-2">
            {summary.top_categories.map((c: any) => (
              <span key={c.primary_category} className="text-xs px-3 py-1 bg-surface-2 border border-accent/15 rounded-full text-slate-300">
                {c.primary_category || 'unknown'} <span className="font-bold text-accent-2">{c.cnt}</span>
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
            {config.map((item) => (
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
    daily_fetch:              { label: 'Daily Fetch (8 AM UTC)',        color: 'text-cyan-400'   },
    weekly_rescore:           { label: 'Weekly Rescore (Sun 2 AM UTC)', color: 'text-purple-400' },
    weekly_content_transition:{ label: 'Content Transition (Mon 00:05)',color: 'text-orange-400' },
    enrich_pending:           { label: 'Enrich Papers (every 2h)',      color: 'text-green-400'  },
  }

  const formatNext = (iso: string | null) => {
    if (!iso) return 'N/A'
    const d = new Date(iso)
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
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

// ── APIs & Enrichment ─────────────────────────────────────────────────────────

function ApisAdmin() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, 'ok' | 'fail' | null>>({})

  useEffect(() => {
    adminApi.getConfig()
      .then((r) => {
        const map: Record<string, string> = {}
        for (const item of (r.data || [])) map[item.key] = item.value
        setConfig(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const testApi = async (name: string, url: string) => {
    setTesting(name)
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      setResults((r) => ({ ...r, [name]: res.ok ? 'ok' : 'fail' }))
    } catch {
      setResults((r) => ({ ...r, [name]: 'fail' }))
    } finally {
      setTesting(null)
    }
  }

  const apis = [
    {
      name: 'ArXiv API',
      key: 'ARXIV_API_URL',
      url: config['ARXIV_API_URL'] || 'http://export.arxiv.org/api/query?search_query=ti:transformer&max_results=1',
      description: 'Used to fetch new AI research papers daily',
      icon: Database,
      color: 'text-cyan-400',
      border: 'border-cyan-500/20',
      bg: 'bg-cyan-500/8',
    },
    {
      name: 'Semantic Scholar',
      key: 'SEMANTIC_SCHOLAR_API_URL',
      url: config['SEMANTIC_SCHOLAR_API_URL'] || 'https://api.semanticscholar.org/graph/v1',
      description: 'Enriches papers with citation counts and author h-index',
      icon: Brain,
      color: 'text-purple-400',
      border: 'border-purple-500/20',
      bg: 'bg-purple-500/8',
    },
    {
      name: 'Papers with Code',
      key: 'PAPERS_WITH_CODE_API_URL',
      url: config['PAPERS_WITH_CODE_API_URL'] || 'https://paperswithcode.com/api/v1',
      description: 'Links papers to GitHub repositories and code implementations',
      icon: Zap,
      color: 'text-green-400',
      border: 'border-green-500/20',
      bg: 'bg-green-500/8',
    },
  ]

  const statusIcon = (name: string) => {
    const r = results[name]
    if (testing === name) return <Loader2 size={14} className="animate-spin text-muted" />
    if (r === 'ok') return <CheckCircle size={14} className="text-success" />
    if (r === 'fail') return <WifiOff size={14} className="text-red-400" />
    return <Wifi size={14} className="text-muted" />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Data Sources & APIs</h1>
      <p className="text-sm text-muted">These APIs are used to fetch, enrich and enhance paper data automatically. Test connectivity below.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-4">
          {apis.map(({ name, url, description, icon: Icon, color, border, bg }) => (
            <div key={name} className={`bg-surface border ${border} rounded-2xl p-5`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center shrink-0`}>
                    <Icon size={18} className={color} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{name}</h3>
                      {statusIcon(name)}
                      {results[name] === 'ok' && <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">reachable</span>}
                      {results[name] === 'fail' && <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">unreachable</span>}
                    </div>
                    <p className="text-xs text-muted mt-0.5">{description}</p>
                    <p className="text-xs font-mono text-slate-500 mt-1 truncate max-w-xs">{url}</p>
                  </div>
                </div>
                <button
                  onClick={() => testApi(name, url)}
                  disabled={testing === name}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-accent/20 text-muted hover:text-white text-xs rounded-xl transition-all disabled:opacity-50 shrink-0"
                >
                  {testing === name ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                  Test
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SchedulerStatus />

      <div className="bg-surface border border-accent/15 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Pipeline Overview</h2>
        <div className="space-y-2 text-xs text-muted">
          {[
            ['1. Fetch', 'ArXiv API → downloads new papers matching AI/ML categories'],
            ['2. Enrich', 'Semantic Scholar + Papers with Code → adds citations, stars, GitHub links'],
            ['3. Score', 'TF-IDF keyword scoring + Gemini AI validation (via OpenRouter)'],
            ['4. Rank', 'Normalize scores globally (0–1), assign trend labels'],
            ['5. Serve', 'Feed API returns sorted sections: Trending, Rising, Hidden Gems'],
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
            <Route path="users" element={<UsersAdmin />} />
            <Route path="config" element={<ConfigAdmin />} />
            <Route path="apis" element={<ApisAdmin />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
