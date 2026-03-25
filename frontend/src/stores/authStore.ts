import { create } from 'zustand'

interface AuthStore {
  token: string | null
  role: string | null
  email: string | null
  isAuthenticated: boolean
  setAuth: (token: string, role: string, email: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: localStorage.getItem('auth_token'),
  role: localStorage.getItem('user_role'),
  email: localStorage.getItem('user_email'),
  isAuthenticated: !!localStorage.getItem('auth_token'),

  setAuth: (token, role, email) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('user_role', role)
    localStorage.setItem('user_email', email)
    set({ token, role, email, isAuthenticated: true })
  },
  clearAuth: () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_role')
    localStorage.removeItem('user_email')
    set({ token: null, role: null, email: null, isAuthenticated: false })
  },
}))
