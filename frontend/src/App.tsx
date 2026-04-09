import { Routes, Route, Navigate } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { PaperPage } from '@/pages/PaperPage'
import { CategoryPage } from '@/pages/CategoryPage'
import { AdminPage } from '@/pages/AdminPage'
import { LoginPage } from '@/pages/LoginPage'
import { LandingPage } from '@/pages/LandingPage'
import { TopicPage } from '@/pages/TopicPage'
import { ReportPage } from '@/pages/ReportPage'
import AutonomousFeed from '@/pages/AutonomousFeed'
import { useAuthStore } from '@/stores/authStore'
import { HexagonPattern } from '@/components/ui/MagicUI'

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role } = useAuthStore()
  if (!isAuthenticated || role !== 'admin') return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <HexagonPattern />
    <Routes>
      {/* Public landing — non-technical users enter here */}
      <Route path="/" element={<LandingPage />} />

      {/* Topic drill-down — all papers in a human topic */}
      <Route path="/explore/:topic" element={<TopicPage />} />

      {/* Report / digest — between landing and raw paper */}
      <Route path="/report/:id" element={<ReportPage />} />

      {/* Researcher-facing dashboard */}
      <Route path="/dashboard" element={<HomePage />} />

      {/* Paper detail (existing) */}
      <Route path="/paper/:id" element={<PaperPage />} />

      {/* Category pages (existing) */}
      <Route path="/papers/:type" element={<CategoryPage />} />

      {/* AI Editor Feed — Hacker News-style autonomous digest */}
      <Route path="/editor-feed" element={<AutonomousFeed />} />

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
    </>
  )
}
