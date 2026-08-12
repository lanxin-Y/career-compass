import { useState } from 'react'

export default function Login({ onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const expected = import.meta.env.VITE_ACCESS_CODE
    if (!expected) {
      setError(true)
      window.setTimeout(() => setError(false), 2000)
      return
    }
    if (code === expected) {
      sessionStorage.setItem('unlocked', 'true')
      onUnlock()
    } else {
      setError(true)
      window.setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <h1 className="text-2xl font-medium mb-2 text-ink">Career Compass</h1>
        <p className="text-sm text-muted mb-6">Enter access code to continue</p>
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            className="w-48 px-4 py-2 border border-slate-300 rounded-lg text-center text-sm focus:outline-none focus:border-accent"
            autoFocus
          />
          <button
            type="submit"
            className="w-48 px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-dark transition"
          >
            Enter
          </button>
          {error && (
            <p className="text-red-500 text-xs">Invalid code, try again</p>
          )}
        </form>
      </div>
    </div>
  )
}
