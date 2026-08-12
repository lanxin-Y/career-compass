import { ArrowRight, CheckCircle2 } from 'lucide-react'

export default function SuggestionCard({
  suggestion,
  hasPlan,
  onSelect,
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-accent/40 hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold text-ink">{suggestion.title}</h3>
            {suggestion.priority && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-muted capitalize">
                {suggestion.priority}
              </span>
            )}
          </div>
          <p className="text-sm text-muted line-clamp-2">{suggestion.why}</p>
          {suggestion.estimated_time && (
            <p className="mt-2 text-xs text-muted">Est. {suggestion.estimated_time}</p>
          )}
        </div>
        <div className="shrink-0 pt-0.5">
          {hasPlan ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Plan Created
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-accent">
              View details
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
