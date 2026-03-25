import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, Mail, Lock, LogIn, UserPlus, User } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

export function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authApi.login(email, password)
      setAuth(res.data.access_token, res.data.role, email)
      toast.success('Welcome back!')
      navigate(res.data.role === 'admin' ? '/admin' : '/')
    } catch {
      toast.error('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) { toast.error('Username required'); return }
    setLoading(true)
    try {
      const res = await authApi.register(email, username, password)
      setAuth(res.data.access_token, res.data.role, email)
      toast.success('Account created!')
      navigate('/')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Registration failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-surface border border-accent/20 rounded-2xl p-8 shadow-card">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center">
              <Cpu size={20} className="text-accent-2" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">AI Research Intelligence</h1>
              <p className="text-xs text-muted">Your personalized AI paper feed</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-surface-2 rounded-xl p-1 mb-6">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'login' ? 'bg-accent/20 text-white' : 'text-muted hover:text-white'
              }`}
            >
              <LogIn size={14} /> Sign In
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'register' ? 'bg-accent/20 text-white' : 'text-muted hover:text-white'
              }`}
            >
              <UserPlus size={14} /> Register
            </button>
          </div>

          <AnimatePresence mode="wait">
            {tab === 'login' ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs text-muted mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                      placeholder="admin@research.ai"
                      className="w-full bg-surface-2 border border-accent/20 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                      placeholder="••••••••"
                      className="w-full bg-surface-2 border border-accent/20 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 transition-all" />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent hover:bg-accent/80 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-glow">
                  {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn size={15} /> Sign In</>}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs text-muted mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                      placeholder="you@example.com"
                      className="w-full bg-surface-2 border border-accent/20 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 block">Username</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
                      placeholder="your_username"
                      className="w-full bg-surface-2 border border-accent/20 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                      placeholder="••••••••" minLength={6}
                      className="w-full bg-surface-2 border border-accent/20 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/50 transition-all" />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent hover:bg-accent/80 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-glow">
                  {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus size={15} /> Create Account</>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-center text-xs text-muted mt-6">
            <Link to="/" className="text-accent-2 hover:underline">← Browse without signing in</Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted mt-4">
          Admin: admin@research.ai · Admin123!
        </p>
      </motion.div>
    </div>
  )
}
