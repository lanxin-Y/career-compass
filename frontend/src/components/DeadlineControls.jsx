import { useState } from 'react'
import { updateAnalysisDeadline } from '../api'

function formatDate(value) {
  if (!value) return ''
  try {
    // Prefer calendar date without timezone shift for YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number)
      return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

export default function DeadlineControls({
  analysisId,
  createdAt,
  deadline,
  onUpdated,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(deadline || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save(next) {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateAnalysisDeadline(analysisId, next || null)
      onUpdated?.(updated.deadline || null)
      setEditing(false)
    } catch (err) {
      setError(err?.detail || 'Failed to save deadline.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>Created {formatDate(createdAt)}</span>
        <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
          {editing ? (
            <>
              <input
                type="date"
                value={draft || ''}
                onChange={(e) => setDraft(e.target.value)}
                className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-ink"
                disabled={saving}
              />
              <button
                type="button"
                disabled={saving || !draft}
                onClick={() => save(draft)}
                className="font-medium text-accent hover:underline disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditing(false)
                  setDraft(deadline || '')
                }}
                className="text-muted hover:underline"
              >
                Cancel
              </button>
            </>
          ) : deadline ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(deadline)
                  setEditing(true)
                }}
                className="font-medium text-ink hover:text-accent"
                title="Edit deadline"
              >
                DDL {formatDate(deadline)}
              </button>
              <button
                type="button"
                onClick={() => save(null)}
                className="text-muted hover:underline"
                disabled={saving}
              >
                Clear
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft('')
                setEditing(true)
              }}
              className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-muted hover:bg-slate-200 hover:text-ink"
            >
              Add DDL
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-right text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
