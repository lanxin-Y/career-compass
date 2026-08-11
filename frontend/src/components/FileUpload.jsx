import { FileUp } from 'lucide-react'
import { useRef, useState } from 'react'

export default function FileUpload({ file, onFileChange, error }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function acceptFile(next) {
    if (!next) return
    if (!next.name.toLowerCase().endsWith('.pdf')) {
      onFileChange(null, 'Please upload a PDF resume.')
      return
    }
    onFileChange(next, null)
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          acceptFile(e.dataTransfer.files?.[0])
        }}
        className={`w-full rounded-lg border-2 border-dashed px-4 py-8 text-center transition ${
          dragging
            ? 'border-accent bg-indigo-50'
            : 'border-slate-200 hover:border-accent/60 bg-slate-50/50'
        }`}
      >
        <FileUp className="mx-auto mb-2 h-6 w-6 text-muted" />
        <p className="text-sm text-ink">
          {file ? (
            <span className="font-medium">{file.name}</span>
          ) : (
            <>
              Drag & drop your resume PDF, or{' '}
              <span className="text-accent font-medium">browse</span>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-muted">PDF only</p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
