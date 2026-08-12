import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getAllTasks } from '../api'
import { computeStats } from '../utils/gamification'

const StatsContext = createContext(null)

export function StatsProvider({ children }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [serverError, setServerError] = useState(null)
  const [levelUpToast, setLevelUpToast] = useState(null)
  const [pulseLevel, setPulseLevel] = useState(false)

  const refreshStats = useCallback(async () => {
    try {
      const collected = await getAllTasks()
      setTasks(collected)
      setServerError(null)
    } catch {
      setServerError(
        'Cannot connect to server. Make sure the backend is running on port 8000.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  const stats = useMemo(() => computeStats(tasks), [tasks])

  const applyTaskUpdate = useCallback((updatedTask) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === updatedTask.id)
      const next = exists
        ? prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
        : [...prev, updatedTask]
      const before = computeStats(prev)
      const after = computeStats(next)
      if (after.level > before.level) {
        setLevelUpToast(`Level up! You're now a ${after.title}.`)
        setPulseLevel(true)
        window.setTimeout(() => setPulseLevel(false), 1600)
        window.setTimeout(() => setLevelUpToast(null), 3200)
      }
      return next
    })
  }, [])

  const value = {
    tasks,
    stats,
    loading,
    serverError,
    levelUpToast,
    pulseLevel,
    refreshStats,
    applyTaskUpdate,
    clearServerError: () => setServerError(null),
  }

  return <StatsContext.Provider value={value}>{children}</StatsContext.Provider>
}

export function useStats() {
  const ctx = useContext(StatsContext)
  if (!ctx) throw new Error('useStats must be used within StatsProvider')
  return ctx
}
