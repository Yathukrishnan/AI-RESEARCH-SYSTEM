import { Routes, Route, Navigate } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { PaperPage } from '@/pages/PaperPage'
import { AdminPage } from '@/pages/AdminPage'
import { LoginPage } from '@/pages/LoginPage'
import { useAuthStore } from '@/stores/authStore'

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role } = useAuthStore()
  if (!isAuthenticated || role !== 'admin') return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/paper/:id" element={<PaperPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin/*"
        element={
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        }
      />
    </Routes>
  )
}
