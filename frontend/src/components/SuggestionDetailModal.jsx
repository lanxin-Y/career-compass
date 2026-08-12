import { useState } from 'react'
import { Loader2, X } from 'lucide-react'

export default function SuggestionDetailModal({
  suggestion,
  index,
  hasPlan,
  loading,
  onClose,
  onConfirmDeepDive,
  onOpenPlan,
}) {
  const [notes, setNotes] = useState('')

  if (!suggestion) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-6"
      onClick={() => !loading && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-wide text-muted">
              Suggestion {index + 1}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{suggestion.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          {suggestion.why && (
            <div>
              <p className="font-medium text-ink">Why this helps</p>
              <p className="mt-1 text-muted leading-relaxed">{suggestion.why}</p>
            </div>
          )}

          {(suggestion.examples || []).length > 0 && (
            <div>
              <p className="font-medium text-ink">Example directions</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                {suggestion.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            {suggestion.estimated_time && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-muted">
                Est. {suggestion.estimated_time}
              </span>
            )}
            {suggestion.priority && (
              <span className="rounded-full bg-violet-50 px-2.5 py-1 capitalize text-violet-700">
                {suggestion.priority} priority
              </span>
            )}
          </div>
        </div>

        {hasPlan ? (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-ink hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onOpenPlan}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
            >
              Open existing plan
            </button>
          </div>
        ) : (
          <>
            <label className="mt-6 block text-sm">
              <span className="mb-1.5 block font-medium text-ink">
                Your notes <span className="font-normal text-muted">(optional)</span>
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="e.g. Keep this project idea, but use game data instead of finance data."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-accent"
                disabled={loading}
              />
            </label>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-ink hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirmDeepDive(notes.trim())}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating plan...
                  </>
                ) : (
                  'Confirm Deep Dive'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
