import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Cpu, Shield, LogOut, X, Menu } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { feedApi } from '@/lib/api'
import { PaperCard } from '@/lib/types'
import toast from 'react-hot-toast'

export function Navbar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PaperCard[]>([])
  const [searching, setSearching] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const { isAuthenticated, role, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await feedApi.search(query)
      setResults(res.data.papers || [])
    } catch {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
  }

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-white/7">
      <div className="max-w-7xl mx-auto px-4 h-13 flex items-center gap-5" style={{ height: '52px' }}>

        {/* Wordmark logo */}
        <Link to="/" className="shrink-0 flex items-center gap-2.5 group" onClick={clearSearch}>
          <div className="w-7 h-7 bg-accent/15 border border-accent/30 flex items-center justify-center">
            <Cpu size={14} className="text-accent" />
          </div>
          <div className="hidden sm:flex flex-col leading-none gap-0.5">
            <span className="text-[12px] font-black text-white tracking-tight uppercase leading-none">
              AI<span className="text-accent">·</span>Research
            </span>
            <span className="text-[9px] font-mono text-muted uppercase tracking-[0.12em] leading-none">
              Intelligence System
            </span>
          </div>
        </Link>

        {/* Vertical divider */}
        <div className="hidden sm:block w-px h-5 bg-white/10 shrink-0" />

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/60 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search papers, topics, authors…"
              className="w-full bg-surface border border-white/10 rounded py-1.5 pl-8 pr-8 text-[13px] text-white placeholder-muted/40 focus:outline-none focus:border-accent/35 transition-colors"
            />
            {query && (
              <button type="button" onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted/50 hover:text-white transition-colors">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute top-full mt-1.5 w-full bg-surface border border-white/12 shadow-card overflow-hidden z-50"
              >
                {results.slice(0, 6).map((p) => (
                  <Link
                    key={p.id}
                    to={`/report/${p.id}`}
                    onClick={clearSearch}
                    className="block px-4 py-3 hover:bg-surface-2 border-b border-white/6 last:border-0 transition-colors"
                  >
                    <p className="text-[13px] text-white font-medium line-clamp-1">{p.hook_text || p.title}</p>
                    <p className="text-[11px] text-muted font-mono mt-0.5">{p.primary_category} · {p.authors[0]?.name}</p>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Desktop nav links */}
        <nav className="hidden sm:flex items-center ml-auto shrink-0">
          {location.pathname === '/' && (
            <Link
              to="/dashboard"
              className="text-[12px] text-muted/70 hover:text-white px-3 py-1.5 transition-colors"
            >
              Researcher View
            </Link>
          )}
          {location.pathname === '/dashboard' && (
            <Link
              to="/"
              className="text-[12px] text-muted/70 hover:text-white px-3 py-1.5 transition-colors"
            >
              Explore
            </Link>
          )}
          <Link
            to="/editor-feed"
            className="text-[12px] text-[#ff6600]/60 hover:text-[#ff6600] px-3 py-1.5 transition-colors font-mono"
          >
            Live
          </Link>
          {isAuthenticated && role === 'admin' && (
            <Link
              to="/admin"
              className="text-[12px] text-accent/70 hover:text-accent flex items-center gap-1 px-3 py-1.5 transition-colors"
            >
              <Shield size={11} />
              Admin
            </Link>
          )}
          <div className="w-px h-4 bg-white/10 mx-1" />
          {isAuthenticated ? (
            <button
              onClick={() => { clearAuth(); navigate('/') }}
              className="text-[12px] text-muted/60 hover:text-danger flex items-center gap-1.5 px-3 py-1.5 transition-colors"
            >
              <LogOut size={11} />
              <span>Logout</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="text-[12px] bg-accent text-black font-bold px-3 py-1.5 hover:bg-accent-2 transition-colors tracking-wide"
            >
              Login
            </Link>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setShowMenu((m) => !m)}
          className="sm:hidden ml-auto text-muted/70 hover:text-white transition-colors"
        >
          {showMenu ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="sm:hidden overflow-hidden border-t border-white/7 bg-surface"
          >
            <div className="px-4 py-3 flex flex-col gap-1">
              <Link to="/" onClick={() => setShowMenu(false)} className="text-sm text-muted hover:text-white py-2 transition-colors">Home</Link>
              <Link to="/dashboard" onClick={() => setShowMenu(false)} className="text-sm text-muted hover:text-white py-2 transition-colors">Researcher View</Link>
              <Link to="/editor-feed" onClick={() => setShowMenu(false)} className="text-sm text-[#ff6600]/70 hover:text-[#ff6600] py-2 transition-colors font-mono">Live Feed</Link>
              {isAuthenticated && role === 'admin' && (
                <Link to="/admin" onClick={() => setShowMenu(false)} className="text-sm text-accent/70 hover:text-accent py-2 transition-colors">Admin</Link>
              )}
              {isAuthenticated ? (
                <button onClick={() => { clearAuth(); navigate('/'); setShowMenu(false) }} className="text-sm text-danger/70 hover:text-danger text-left py-2 transition-colors">Logout</button>
              ) : (
                <Link to="/login" onClick={() => setShowMenu(false)} className="text-sm font-bold text-accent py-2 transition-colors">Login</Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
