import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { analyzeGap } from '../api'
import FileUpload from '../components/FileUpload'
import { useStats } from '../context/StatsContext'

export default function NewAnalysis() {
  const navigate = useNavigate()
  const { refreshStats } = useStats()
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jdText, setJdText] = useState('')
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [error, setError] = useState(null)
  const [cachedNote, setCachedNote] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setCachedNote(null)

    if (!jdText.trim()) {
      setError('Please paste a job description.')
      return
    }
    if (!file) {
      setFileError('Please upload a PDF resume.')
      return
    }

    setLoading(true)
    try {
      const result = await analyzeGap(jdText, file, jobTitle.trim(), company.trim())
      if (result.cached) {
        setCachedNote('Retrieved from previous analysis')
      }
      await refreshStats()
      navigate(`/analysis/${result.id}`, {
        state: { cached: !!result.cached },
      })
    } catch (err) {
      const detail = err?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
            : 'Analysis failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New Analysis</h1>
      <p className="mt-1 text-sm text-muted">
        Paste a job description and upload your resume to find skill gaps.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Job Title</span>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Data Scientist"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Company</span>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Google"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-accent"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">
            Job Description <span className="text-red-500">*</span>
          </span>
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            rows={10}
            required
            placeholder="Paste the full job description here..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        <div className="text-sm">
          <span className="mb-1.5 block font-medium">
            Resume PDF <span className="text-red-500">*</span>
          </span>
          <FileUpload
            file={file}
            error={fileError}
            onFileChange={(next, err) => {
              setFile(next)
              setFileError(err)
            }}
          />
        </div>

        {cachedNote && <p className="text-sm text-muted">{cachedNote}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing... (this may take 15-30 seconds)
            </>
          ) : (
            'Analyze My Gap'
          )}
        </button>
        {loading && (
          <p className="text-center text-xs text-muted">
            This usually takes 15-30 seconds.
          </p>
        )}
      </form>
    </div>
  )
}
