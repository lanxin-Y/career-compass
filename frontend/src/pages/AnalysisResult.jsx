import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { deepDive, getAnalysis } from '../api'
import SuggestionCard from '../components/SuggestionCard'
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

export default function AnalysisResult() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshStats } = useStats()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [divingIndex, setDivingIndex] = useState(null)

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

  async function handleDeepDive(index) {
    setDivingIndex(index)
    setError(null)
    try {
      const result = await deepDive(id, String(index))
      await refreshStats()
      navigate(`/deep-dive/${result.id}`)
    } catch (err) {
      setError(err?.detail || 'Failed to generate deep-dive plan.')
      setDivingIndex(null)
    }
  }

  function handleOpenPlan(index, title) {
    const dive = findDiveForSuggestion(index, title)
    if (dive) navigate(`/deep-dive/${dive.id}`)
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

  return (
    <div className="space-y-8">
      <div>
        <Link to="/" className="text-sm text-accent hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {data.job_title || 'Untitled analysis'}
          {data.company ? (
            <span className="font-normal text-muted"> · {data.company}</span>
          ) : null}
        </h1>
        <p className="mt-1 text-sm text-muted">{formatDate(data.created_at)}</p>
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
              {result.matching_skills.slice(0, 12).map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-success"
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
                  <span className="font-medium">{gap.skill}</span>
                  <span className="ml-2 font-mono text-[11px] uppercase text-muted">
                    {gap.importance}
                  </span>
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
        <h2 className="text-lg font-semibold mb-3">Growth suggestions</h2>
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <SuggestionCard
              key={`${suggestion.title}-${index}`}
              suggestion={suggestion}
              index={index}
              hasPlan={
                plannedKeys.has(String(index)) ||
                plannedKeys.has(`suggestions[${index}]`) ||
                plannedKeys.has(suggestion.title)
              }
              loading={divingIndex === index}
              onDeepDive={handleDeepDive}
              onOpenPlan={() => handleOpenPlan(index, suggestion.title)}
            />
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      {data.deep_dives?.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Your Plans</h2>
          <ul className="space-y-2">
            {data.deep_dives.map((dive) => (
              <li key={dive.id}>
                <Link
                  to={`/deep-dive/${dive.id}`}
                  className="block rounded-lg border border-slate-200 px-4 py-3 text-sm hover:border-accent/40"
                >
                  <span className="font-medium">
                    {dive.plan?.plan_title || `Plan for suggestion ${dive.suggestion_key}`}
                  </span>
                  <span className="ml-2 text-muted">
                    {(dive.tasks || []).filter((t) => t.is_completed).length}/
                    {(dive.tasks || []).length} tasks
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
