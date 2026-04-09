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
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'
import { cn } from '@/lib/utils'

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role } = useAuthStore()
  if (!isAuthenticated || role !== 'admin') return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <AnimatedGridPattern
        numSquares={35}
        maxOpacity={0.055}
        duration={3.5}
        repeatDelay={0.8}
        className={cn(
          'fixed inset-0 -z-10 h-full w-full',
          'fill-amber-500/20 stroke-amber-500/8',
          '[mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,white_30%,transparent_100%)]',
        )}
      />
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
