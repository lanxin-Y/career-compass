import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { createManualPlan } from '../api'
import { useStats } from '../context/StatsContext'

function emptyTask() {
  return { title: '', timeframe: '' }
}

export default function NewProject() {
  const navigate = useNavigate()
  const { refreshStats } = useStats()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [tasks, setTasks] = useState([emptyTask(), emptyTask()])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function updateTask(index, field, value) {
    setTasks((prev) =>
      prev.map((task, i) => (i === index ? { ...task, [field]: value } : task)),
    )
  }

  function addTaskRow() {
    setTasks((prev) => [...prev, emptyTask()])
  }

  function removeTaskRow(index) {
    setTasks((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const cleanedTasks = tasks
      .map((t) => ({
        title: t.title.trim(),
        timeframe: t.timeframe.trim() || null,
      }))
      .filter((t) => t.title)

    if (!title.trim()) {
      setError('Please enter a project title.')
      return
    }
    if (cleanedTasks.length === 0) {
      setError('Add at least one sub-task.')
      return
    }

    setLoading(true)
    try {
      const plan = await createManualPlan({
        title: title.trim(),
        description: description.trim(),
        estimated_time: estimatedTime.trim() || null,
        tasks: cleanedTasks,
      })
      await refreshStats()
      navigate(`/deep-dive/${plan.id}`)
    } catch (err) {
      const detail = err?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : 'Failed to create project. Is the backend running?',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Link to="/" className="text-sm text-accent hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">New Project</h1>
      <p className="mt-1 text-sm text-muted">
        Create a checklist yourself — same format as AI deep-dive plans (no API call).
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">
            Project title <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Build a portfolio data pipeline"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What is this project about? Why does it matter?"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Overall estimated time</span>
          <input
            type="text"
            value={estimatedTime}
            onChange={(e) => setEstimatedTime(e.target.value)}
            placeholder='e.g. "2 weeks"'
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              Sub-tasks <span className="text-red-500">*</span>
            </span>
            <button
              type="button"
              onClick={addTaskRow}
              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add task
            </button>
          </div>
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center"
              >
                <input
                  type="text"
                  value={task.title}
                  onChange={(e) => updateTask(index, 'title', e.target.value)}
                  placeholder={`Task ${index + 1} title`}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <input
                  type="text"
                  value={task.timeframe}
                  onChange={(e) => updateTask(index, 'timeframe', e.target.value)}
                  placeholder='Time e.g. "3 days"'
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent sm:w-36"
                />
                <button
                  type="button"
                  onClick={() => removeTaskRow(index)}
                  disabled={tasks.length <= 1}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-muted hover:border-red-200 hover:text-red-600 disabled:opacity-40"
                  title="Remove task"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Create project'
          )}
        </button>
      </form>
    </div>
  )
}
