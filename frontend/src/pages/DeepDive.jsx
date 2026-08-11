import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getDeepDive, toggleTask } from '../api'
import TaskItem from '../components/TaskItem'
import { useStats } from '../context/StatsContext'

export default function DeepDive() {
  const { id } = useParams()
  const { applyTaskUpdate, refreshStats } = useStats()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const dive = await getDeepDive(id)
        if (!cancelled) {
          setData(dive)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err?.detail || 'Failed to load plan.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const sortedTasks = useMemo(() => {
    const tasks = [...(data?.tasks || [])]
    return tasks.sort((a, b) => {
      if (a.is_completed === b.is_completed) return a.sort_order - b.sort_order
      return a.is_completed ? 1 : -1
    })
  }, [data])

  const completedCount = (data?.tasks || []).filter((t) => t.is_completed).length
  const totalCount = (data?.tasks || []).length
  const progress = totalCount ? completedCount / totalCount : 0

  async function handleToggle(taskId, isCompleted) {
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, is_completed: isCompleted } : t,
        ),
      }
    })
    try {
      const updated = await toggleTask(taskId, isCompleted)
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
        }
      })
      applyTaskUpdate(updated)
      return updated
    } catch (err) {
      // Revert
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, is_completed: !isCompleted } : t,
          ),
        }
      })
      throw err
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your plan...
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error || 'Plan not found.'}</p>
  }

  const plan = data.plan || {}
  const resources = []
  for (const step of plan.steps || []) {
    for (const res of step.resources || []) {
      if (res?.url) resources.push(res)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          to={`/analysis/${data.analysis_id}`}
          className="text-sm text-accent hover:underline"
          onClick={() => refreshStats()}
        >
          ← Back to analysis
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {plan.plan_title || 'Deep Dive Plan'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Suggestion key: {data.suggestion_key}
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">Plan overview</h2>
        <p className="text-sm text-ink leading-relaxed">
          {plan.description || plan.summary || 'No summary provided.'}
        </p>
        {plan.success_criteria && (
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">Success criteria: </span>
            {plan.success_criteria}
          </p>
        )}
        {plan.resume_bullet && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <p className="text-xs font-medium text-muted mb-1">Resume bullet</p>
            <p>{plan.resume_bullet}</p>
          </div>
        )}
        {resources.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Resources</p>
            <ul className="list-disc pl-5 text-sm text-accent space-y-1">
              {resources.slice(0, 8).map((res) => (
                <li key={`${res.name}-${res.url}`}>
                  <a href={res.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {res.name || res.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Todo checklist</h2>
            <p className="text-sm text-muted">
              {completedCount}/{totalCount} tasks completed
            </p>
          </div>
        </div>
        <div className="mb-4 h-2 rounded-full bg-track overflow-hidden">
          <div
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="space-y-2">
          {sortedTasks.map((task) => (
            <TaskItem key={task.id} task={task} onToggle={handleToggle} />
          ))}
          {sortedTasks.length === 0 && (
            <p className="text-sm text-muted">
              No checklist tasks for this plan yet. Generate a new deep-dive after the
              latest backend update to populate todos.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
