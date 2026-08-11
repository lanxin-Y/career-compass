import { useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { getTaskXP } from '../utils/gamification'

export default function TaskItem({ task, onToggle }) {
  const checkboxRef = useRef(null)
  const [floatXP, setFloatXP] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleChange(e) {
    const next = e.target.checked
    setBusy(true)
    setError(null)
    try {
      await onToggle(task.id, next)
      if (next && checkboxRef.current) {
        const rect = checkboxRef.current.getBoundingClientRect()
        const x = (rect.left + rect.width / 2) / window.innerWidth
        const y = (rect.top + rect.height / 2) / window.innerHeight
        confetti({
          particleCount: 24,
          spread: 55,
          startVelocity: 22,
          origin: { x, y },
          colors: ['#6366F1', '#10B981', '#F59E0B', '#A5B4FC'],
          scalar: 0.7,
          disableForReducedMotion: true,
        })
        const xp = getTaskXP(task.timeframe)
        setFloatXP(`+${xp} XP`)
        window.setTimeout(() => setFloatXP(null), 1000)
      }
    } catch {
      setError('Failed to save, please try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`relative flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-3 transition-all duration-300 ease-out ${
        task.is_completed ? 'bg-slate-50' : 'bg-white'
      }`}
    >
      <div className="relative mt-0.5">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={!!task.is_completed}
          disabled={busy}
          onChange={handleChange}
          className="h-4 w-4 rounded border-slate-300 text-success accent-success cursor-pointer"
        />
        {floatXP && (
          <span className="pointer-events-none absolute -top-1 left-5 whitespace-nowrap text-xs font-semibold text-accent animate-float-up">
            {floatXP}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm transition-colors duration-300 ${
            task.is_completed ? 'text-muted' : 'text-ink'
          }`}
        >
          {task.title}
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      {task.timeframe && (
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-muted">
          {task.timeframe}
        </span>
      )}
    </div>
  )
}
