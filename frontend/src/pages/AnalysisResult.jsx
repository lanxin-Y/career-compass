import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { deepDive, getAnalysis } from '../api'
import DeadlineControls from '../components/DeadlineControls'
import SuggestionCard from '../components/SuggestionCard'
import SuggestionDetailModal from '../components/SuggestionDetailModal'
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

const SKILL_CHIP_STYLES = [
  'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
  'bg-violet-50 text-violet-700 ring-1 ring-violet-100',
  'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
]

function importanceBadgeClass(importance) {
  const key = String(importance || '').toLowerCase()
  if (key === 'high') return 'bg-violet-700 text-white'
  if (key === 'medium') return 'bg-violet-400 text-white'
  return 'bg-violet-200 text-violet-800'
}

export default function AnalysisResult() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { provider } = useProvider()
  const { refreshStats } = useStats()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const detail = await getAnalysis(id)
        if (!cancelled) {
          setData(detail)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err?.detail || 'Failed to load analysis.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const plannedKeys = useMemo(() => {
    const set = new Set()
    for (const dive of data?.deep_dives || []) {
      set.add(String(dive.suggestion_key))
    }
    return set
  }, [data])

  function findDiveForSuggestion(index, title) {
    return (data?.deep_dives || []).find(
      (dive) =>
        String(dive.suggestion_key) === String(index) ||
        dive.suggestion_key === `suggestions[${index}]` ||
        dive.suggestion_key === title,
    )
  }

  function suggestionHasPlan(index, title) {
    return (
      plannedKeys.has(String(index)) ||
      plannedKeys.has(`suggestions[${index}]`) ||
      plannedKeys.has(title)
    )
  }

  async function handleConfirmDeepDive(notes) {
    if (selectedIndex == null) return
    setConfirming(true)
    setError(null)
    try {
      const result = await deepDive(id, String(selectedIndex), notes || null, provider)
      await refreshStats()
      setSelectedIndex(null)
      navigate(`/deep-dive/${result.id}`)
    } catch (err) {
      setError(err?.detail || 'Failed to generate deep-dive plan.')
    } finally {
      setConfirming(false)
    }
  }

  function handleOpenPlan(index, title) {
    const dive = findDiveForSuggestion(index, title)
    if (dive) {
      setSelectedIndex(null)
      navigate(`/deep-dive/${dive.id}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading analysis...
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error || 'Analysis not found.'}</p>
  }

  const result = data.result || {}
  const suggestions = result.suggestions || []
  const gaps = result.skill_gaps || []
  const selectedSuggestion =
    selectedIndex == null ? null : suggestions[selectedIndex] || null
  const openPlanCount = (data.deep_dives || []).filter(
    (dive) => !isProjectComplete(dive),
  ).length

  return (
    <div className="space-y-8">
      <div>
        <Link to="/" className="text-sm text-accent hover:underline">
          ← Back to dashboard
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.job_title || 'Untitled analysis'}
            {data.company ? (
              <span className="font-normal text-muted"> · {data.company}</span>
            ) : null}
          </h1>
          {openPlanCount > 0 ? (
            <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700">
              {activePlanLabel(openPlanCount)}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-muted">
              No plan yet
            </span>
          )}
        </div>
        <DeadlineControls
          analysisId={data.id}
          createdAt={data.created_at}
          deadline={data.deadline}
          onUpdated={(deadline) => setData((prev) => (prev ? { ...prev, deadline } : prev))}
        />
        {location.state?.cached && (
          <p className="mt-2 text-xs text-muted">Retrieved from previous analysis</p>
        )}
      </div>

      <section className="rounded-lg border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Gap Analysis</h2>
            <p className="text-sm text-muted mt-1">Round 1 results from your resume vs JD.</p>
          </div>
          {typeof result.match_score === 'number' && (
            <div className="text-right">
              <p className="font-mono text-3xl font-semibold text-accent">
                {result.match_score}
              </p>
              <p className="text-xs text-muted">match score</p>
            </div>
          )}
        </div>

        {result.matching_skills?.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-medium mb-2">Matching skills</h3>
            <div className="flex flex-wrap gap-2">
              {result.matching_skills.slice(0, 12).map((skill, index) => (
                <span
                  key={skill}
                  className={`rounded-full px-2.5 py-1 text-xs ${SKILL_CHIP_STYLES[index % SKILL_CHIP_STYLES.length]}`}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {gaps.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-medium mb-2">Skill gaps</h3>
            <ul className="space-y-2">
              {gaps.slice(0, 6).map((gap) => (
                <li
                  key={`${gap.skill}-${gap.importance}`}
                  className="rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{gap.skill}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${importanceBadgeClass(gap.importance)}`}
                    >
                      {gap.importance}
                    </span>
                  </div>
                  {gap.detail && (
                    <p className="mt-1 text-muted text-xs leading-relaxed">{gap.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1">Growth suggestions</h2>
        <p className="mb-3 text-sm text-muted">
          Click a card to review details, add your notes, then confirm Deep Dive.
        </p>
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <SuggestionCard
              key={`${suggestion.title}-${index}`}
              suggestion={suggestion}
              hasPlan={suggestionHasPlan(index, suggestion.title)}
              onSelect={() => setSelectedIndex(index)}
            />
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      {selectedSuggestion && (
        <SuggestionDetailModal
          suggestion={selectedSuggestion}
          index={selectedIndex}
          hasPlan={suggestionHasPlan(selectedIndex, selectedSuggestion.title)}
          loading={confirming}
          onClose={() => !confirming && setSelectedIndex(null)}
          onConfirmDeepDive={handleConfirmDeepDive}
          onOpenPlan={() =>
            handleOpenPlan(selectedIndex, selectedSuggestion.title)
          }
        />
      )}
    </div>
  )
}
