import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { getAnalysis, getHistory } from '../api'
import { useStats } from '../context/StatsContext'

function formatDate(value) {
  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

export default function Dashboard() {
  const { refreshStats } = useStats()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const history = await getHistory()
        const enriched = await Promise.all(
          history.map(async (row) => {
            try {
              const detail = await getAnalysis(row.id)
              const tasks = (detail.deep_dives || []).flatMap((d) => d.tasks || [])
              const done = tasks.filter((t) => t.is_completed).length
              return { ...row, taskDone: done, taskTotal: tasks.length }
            } catch {
              return { ...row, taskDone: 0, taskTotal: 0 }
            }
          }),
        )
        if (!cancelled) {
          setItems(enriched)
          setError(null)
          refreshStats()
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.detail || 'Failed to load history.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [refreshStats])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Your career gap analyses and progress.</p>
        </div>
        <Link
          to="/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-dark"
        >
          <Plus className="h-4 w-4" />
          New Analysis
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-6 py-16 text-center">
          <p className="text-ink font-medium">No analyses yet.</p>
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
              <Link
                to={`/analysis/${item.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-accent/40 hover:shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium text-ink">
                      {item.job_title || 'Untitled'}
                      {item.company ? (
                        <span className="text-muted font-normal"> · {item.company}</span>
                      ) : null}
                    </h2>
                    <p className="mt-1 text-xs text-muted">{formatDate(item.created_at)}</p>
                  </div>
                  {item.taskTotal > 0 && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-muted">
                      {item.taskDone}/{item.taskTotal} tasks done
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
