import { Compass } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { useStats } from '../context/StatsContext'
import StatsBar from './StatsBar'

export default function Layout() {
  const { serverError, levelUpToast } = useStats()

  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Compass className="h-5 w-5 text-accent" />
            <span>Career Compass</span>
          </Link>
          <StatsBar />
        </div>
      </header>

      {serverError && (
        <div className="bg-red-50 border-b border-red-100 text-red-700 text-sm px-4 py-2 text-center">
          {serverError}
        </div>
      )}

      {levelUpToast && (
        <div className="fixed top-16 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-accent px-4 py-2 text-sm text-white shadow-sm">
          {levelUpToast}
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
