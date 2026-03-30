import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'

/** Returns a hook that rotates daily from a list — same pick for everyone on the same day */
export function dailyHook(hooks: string[]): string {
  const day = Math.floor(Date.now() / 86_400_000)
  return hooks[day % hooks.length]
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Unknown date'
  try { return format(new Date(dateStr), 'MMM d, yyyy') }
  catch { return dateStr }
}

export function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }) }
  catch { return '' }
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + '...'
}

export function fmtScore(score: number): string {
  return (score * 100).toFixed(1)
}

export function getScoreColor(score: number): string {
  if (score >= 0.7) return 'text-success'
  if (score >= 0.4) return 'text-warning'
  return 'text-muted'
}

export function getCategoryStyle(cat: string): string {
  const map: Record<string, string> = {
    'cs.AI': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'cs.LG': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'cs.CL': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    'cs.CV': 'bg-green-500/20 text-green-300 border-green-500/30',
    'cs.NE': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'stat.ML': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  }
  return map[cat] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
}

export function savePaper(id: number) {
  const saved = getSaved()
  if (!saved.includes(id)) localStorage.setItem('saved_papers', JSON.stringify([...saved, id]))
}
export function unsavePaper(id: number) {
  localStorage.setItem('saved_papers', JSON.stringify(getSaved().filter((x) => x !== id)))
}
export function getSaved(): number[] {
  try { return JSON.parse(localStorage.getItem('saved_papers') ?? '[]') }
  catch { return [] }
}
export function isSaved(id: number): boolean { return getSaved().includes(id) }

export function setLastRead(id: number, title: string) {
  localStorage.setItem('last_read', JSON.stringify({ id, title }))
}
export function getLastRead(): { id: number; title: string } | null {
  try { return JSON.parse(localStorage.getItem('last_read') ?? 'null') }
  catch { return null }
}
