import { Circle } from 'lucide-react'
import { useStats } from '../context/StatsContext'

export default function StatsBar() {
  const { stats, pulseLevel } = useStats()
  const pct = Math.max(0, Math.min(100, Math.round(stats.progress * 100)))

  return (
    <div
      className={`flex flex-wrap items-center gap-3 sm:gap-4 ${pulseLevel ? 'animate-level-pulse rounded-lg' : ''}`}
    >
      <span className="font-mono text-xs sm:text-sm rounded-full bg-slate-100 px-2.5 py-1 text-ink">
        Lv.{stats.level} {stats.title}
      </span>

      <div className="flex items-center gap-2 min-w-[140px] sm:min-w-[180px]">
        <div className="relative h-2.5 flex-1 rounded-full bg-track overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[11px] sm:text-xs text-muted whitespace-nowrap">
          {stats.xp} / {stats.nextXP} XP
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-sm">
        <Circle className="h-3.5 w-3.5 fill-coin text-coin" />
        <span className="font-mono text-ink">{stats.coins}</span>
      </div>
    </div>
  )
}
