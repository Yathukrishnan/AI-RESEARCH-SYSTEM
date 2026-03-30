import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { dashboardApi } from '@/lib/api'
import { DashboardData } from '@/lib/types'
import { HeroHook } from './HeroHook'
import { HypeCarousel } from './HypeCarousel'
import { IntelligenceGrid } from './IntelligenceGrid'
import { UnderTheRadar } from './UnderTheRadar'
import { BuildersArsenal } from './BuildersArsenal'
import { VelocityDesk } from './VelocityDesk'
import { TheoryCorner } from './TheoryCorner'
import { ContrarianView } from './ContrarianView'

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    dashboardApi.get()
      .then((r) => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted">
        <Loader2 size={28} className="animate-spin text-accent" />
        <p className="text-sm">Loading Intelligence Dashboard…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-muted text-sm">Failed to load dashboard</p>
        <button onClick={load} className="flex items-center gap-2 text-xs text-accent hover:text-accent-2 transition-colors">
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    )
  }

  const hasData = data.hero || data.hype_carousel.length > 0

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <p className="text-white font-semibold">Dashboard is warming up</p>
        <p className="text-muted text-sm max-w-sm">Papers are being scored and ranked. Check back in a few minutes or trigger a fetch from the admin panel.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Row 1: Hero - full width */}
      {data.hero && <HeroHook paper={data.hero} hook={data.section_hooks?.hero} />}

      {/* Row 2: Hype Carousel */}
      {data.hype_carousel.length > 0 && (
        <HypeCarousel papers={data.hype_carousel} hook={data.section_hooks?.hype_carousel} />
      )}

      {/* Row 3: Intelligence Grid + Under the Radar */}
      {(data.intelligence_grid.length > 0 || data.under_the_radar.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {data.intelligence_grid.length > 0 && (
            <IntelligenceGrid papers={data.intelligence_grid} hook={data.section_hooks?.intelligence_grid} />
          )}
          {data.under_the_radar.length > 0 && (
            <UnderTheRadar papers={data.under_the_radar} hook={data.section_hooks?.under_the_radar} />
          )}
        </div>
      )}

      {/* Row 4: Builder's Arsenal + Velocity Desk */}
      {(data.builders_arsenal.length > 0 || data.velocity_desk.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {data.builders_arsenal.length > 0 && <BuildersArsenal papers={data.builders_arsenal} />}
          {data.velocity_desk.length > 0 && (
            <VelocityDesk papers={data.velocity_desk} hook={data.section_hooks?.velocity_desk} />
          )}
        </div>
      )}

      {/* Row 5: Theory Corner + Contrarian View */}
      {(data.theory_corner.length > 0 || data.contrarian_view.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {data.theory_corner.length > 0 && (
            <TheoryCorner papers={data.theory_corner} hook={data.section_hooks?.theory_corner} />
          )}
          {data.contrarian_view.length > 0 && (
            <ContrarianView papers={data.contrarian_view} hook={data.section_hooks?.contrarian_view} />
          )}
        </div>
      )}
    </div>
  )
}
