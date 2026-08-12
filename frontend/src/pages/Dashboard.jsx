import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { deleteDeepDive, getAllDeepDives, getAnalysis, getHistory } from '../api'
import DeadlineControls from '../components/DeadlineControls'
import { useProvider } from '../context/ProviderContext'
import { useStats } from '../context/StatsContext'

function activePlanLabel(count) {
  if (count === 1) return '1 active plan'
  return `${count} active plans`
}

function isProjectComplete(dive) {
  const tasks = dive.tasks || []
  return tasks.length > 0 && tasks.every((t) => t.is_completed)
}

export default function Dashboard() {
  const { refreshStats } = useStats()
  const { provider, setProvider } = useProvider()
  const [items, setItems] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  async function loadDashboard() {
    setLoading(true)
    try {
      const [history, allDives] = await Promise.all([getHistory(), getAllDeepDives()])
      const analysisMap = {}
      await Promise.all(
        history.map(async (row) => {
          try {
            analysisMap[row.id] = await getAnalysis(row.id)
          } catch {
            analysisMap[row.id] = null
          }
        }),
      )

      const projectRows = allDives.map((dive) => {
        const detail = analysisMap[dive.analysis_id]
        const isManual =
          dive.suggestion_key === 'manual' || dive.analysis_id === '__manual__'
        return {
          id: dive.id,
          title: dive.plan?.plan_title || `Plan (${dive.suggestion_key})`,
          company: isManual ? null : detail?.company,
          job_title: isManual ? 'Manual project' : detail?.job_title,
          analysis_id: dive.analysis_id,
          isManual,
          completed: (dive.tasks || []).filter((t) => t.is_completed).length,
          total: (dive.tasks || []).length,
          isComplete: isProjectComplete(dive),
        }
      })

      // history already sorted by deadline from API
      setItems(
        history.map((row) => {
          const dives = allDives.filter((d) => d.analysis_id === row.id)
          const openProjects = dives.filter((dive) => !isProjectComplete(dive))
          return {
            ...row,
            deadline: row.deadline || analysisMap[row.id]?.deadline || null,
            projectCount: dives.length,
            openProjectCount: openProjects.length,
          }
        }),
      )
      setProjects(projectRows)
      setError(null)
      refreshStats()
    } catch (err) {
      setError(err?.detail || 'Failed to load history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.isComplete),
    [projects],
  )
  const completedProjects = useMemo(
    () => projects.filter((p) => p.isComplete),
    [projects],
  )

  async function handleDelete(projectId) {
    const ok = window.confirm(
      'Delete this plan permanently? This cannot be undone.',
    )
    if (!ok) return
    setDeletingId(projectId)
    try {
      await deleteDeepDive(projectId)
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
      await loadDashboard()
    } catch (err) {
      setError(err?.detail || 'Failed to delete plan.')
    } finally {
      setDeletingId(null)
    }
  }

  function handleDeadlineUpdated(analysisId, deadline) {
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === analysisId ? { ...item, deadline } : item,
      )
      next.sort((a, b) => {
        const ad = a.deadline || ''
        const bd = b.deadline || ''
        if (!ad && !bd) return 0
        if (!ad) return 1
        if (!bd) return -1
        return ad.localeCompare(bd)
      })
      return next
    })
  }

  function ProjectCard({ project, showProgress }) {
    return (
      <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/deep-dive/${project.id}`} className="min-w-0 flex-1 hover:opacity-90">
            <h3 className="font-medium text-ink">{project.title}</h3>
            <p className="mt-1 text-sm text-muted">
              {project.isManual
                ? 'Manual project'
                : `${project.job_title || 'Untitled role'}${
                    project.company ? ` · ${project.company}` : ''
                  }`}
            </p>
            {showProgress && project.total > 0 && (
              <p className="mt-2 font-mono text-[11px] text-muted">
                {project.completed}/{project.total} checklist items
              </p>
            )}
            {!showProgress && project.total > 0 && (
              <p className="mt-2 font-mono text-[11px] text-success">
                All {project.total} checklist items done
              </p>
            )}
          </Link>
          <button
            type="button"
            onClick={() => handleDelete(project.id)}
            disabled={deletingId === project.id}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            title="Delete plan"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deletingId === project.id ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Your career gap analyses and progress.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/new-project"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-ink shadow-sm hover:border-accent/40"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Link>
          <Link
            to="/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-dark"
          >
            <Plus className="h-4 w-4" />
            New Analysis
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">AI provider</h2>
        <div className="mt-3 inline-flex rounded-lg bg-slate-100 p-1">
          {[
            { id: 'claude', label: 'Claude' },
            { id: 'deepseek', label: 'DeepSeek' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setProvider(option.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                provider === option.id
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h2 className="mb-3 text-lg font-semibold">My Quests</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-6 py-16 text-center">
            <p className="text-ink font-medium">No quests yet.</p>
            <p className="mt-1 text-sm text-muted">
              Start your first career gap analysis.
            </p>
            <Link
              to="/new"
              className="mt-6 inline-flex rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-dark"
            >
              New Analysis
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-accent/40 hover:shadow">
                  <Link to={`/analysis/${item.id}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium text-ink">
                          {item.job_title || 'Untitled'}
                          {item.company ? (
                            <span className="text-muted font-normal"> · {item.company}</span>
                          ) : null}
                        </h3>
                      </div>
                      {item.openProjectCount > 0 ? (
                        <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700">
                          {activePlanLabel(item.openProjectCount)}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-muted">
                          No plan yet
                        </span>
                      )}
                    </div>
                  </Link>
                  <DeadlineControls
                    analysisId={item.id}
                    createdAt={item.created_at}
                    deadline={item.deadline}
                    onUpdated={(deadline) => handleDeadlineUpdated(item.id, deadline)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Todo</h2>
          <Link
            to="/new-project"
            className="text-sm font-medium text-accent hover:underline"
          >
            + Add your own project
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : activeProjects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-muted">
            No active projects.{' '}
            <Link to="/new-project" className="text-accent hover:underline">
              Create one manually
            </Link>{' '}
            or generate a Deep Dive from an analysis.
          </div>
        ) : (
          <ul className="space-y-3">
            {activeProjects.map((project) => (
              <ProjectCard key={project.id} project={project} showProgress />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Completed</h2>
        <p className="mb-3 text-sm text-muted">
          Projects where every checklist item is done — a record of what you finished.
        </p>
        {loading ? (
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
        ) : completedProjects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-muted">
            Nothing completed yet. Finish all tasks in a project to see it here.
          </div>
        ) : (
          <ul className="space-y-3">
            {completedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} showProgress={false} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
