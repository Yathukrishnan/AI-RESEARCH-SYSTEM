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
    <header className="sticky top-0 z-50 glass border-b border-accent/10">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0" onClick={clearSearch}>
          <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center">
            <Cpu size={18} className="text-accent-2" />
          </div>
          <span className="font-bold text-white hidden sm:block">
            AI<span className="text-gradient">Research</span>
          </span>
        </Link>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-lg relative">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search papers, topics, authors..."
              className="w-full bg-surface-2 border border-accent/20 rounded-xl py-2 pl-9 pr-10 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 focus:shadow-glow transition-all"
            />
            {query && (
              <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Search dropdown */}
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-full mt-2 w-full bg-surface border border-accent/20 rounded-xl shadow-card overflow-hidden z-50"
              >
                {results.slice(0, 6).map((p) => (
                  <Link
                    key={p.id}
                    to={`/report/${p.id}`}
                    onClick={clearSearch}
                    className="block px-4 py-3 hover:bg-surface-2 border-b border-accent/10 last:border-0"
                  >
                    <p className="text-sm text-white font-medium line-clamp-1">{p.hook_text || p.title}</p>
                    <p className="text-xs text-muted mt-0.5">{p.primary_category} · {p.authors[0]?.name}</p>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Right actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Dashboard link — for power users navigating from landing */}
          {location.pathname === '/' && (
            <Link
              to="/dashboard"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-accent/20 rounded-lg text-xs text-muted hover:text-white hover:border-accent/40 transition-all"
            >
              Researcher View
            </Link>
          )}
          {location.pathname === '/dashboard' && (
            <Link
              to="/"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-accent/20 rounded-lg text-xs text-muted hover:text-white hover:border-accent/40 transition-all"
            >
              Explore →
            </Link>
          )}
          {/* Live Feed — always visible shortcut to HN-style editor digest */}
          <Link
            to="/editor-feed"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-[#ff6600]/30 rounded-lg text-xs text-[#ff6600]/70 hover:text-[#ff6600] hover:border-[#ff6600]/60 transition-all"
          >
            Live Feed
          </Link>
          {isAuthenticated && role === 'admin' && (
            <Link
              to="/admin"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/30 rounded-lg text-xs text-accent-2 hover:bg-accent/20 transition-all"
            >
              <Shield size={13} />
              Admin
            </Link>
          )}
          {isAuthenticated ? (
            <button
              onClick={() => { clearAuth(); navigate('/') }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 border border-danger/30 rounded-lg text-xs text-danger hover:bg-danger/20 transition-all"
            >
              <LogOut size={13} />
              <span className="hidden sm:block">Logout</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent/80 transition-all"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
