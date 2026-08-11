const BASE = 'http://localhost:8000/api'

async function readError(res) {
  try {
    return await res.json()
  } catch {
    return { detail: res.statusText || 'Request failed' }
  }
}

export async function analyzeGap(jdText, resumeFile, jobTitle, company) {
  const form = new FormData()
  form.append('jd_text', jdText)
  form.append('resume', resumeFile)
  if (jobTitle) form.append('job_title', jobTitle)
  if (company) form.append('company', company)
  const res = await fetch(`${BASE}/analyze`, { method: 'POST', body: form })
  if (!res.ok) throw await readError(res)
  return res.json()
}

export async function deepDive(analysisId, suggestionKey, userNotes) {
  const body = {
    analysis_id: analysisId,
    suggestion_key: String(suggestionKey),
  }
  if (userNotes) body.user_notes = userNotes
  const res = await fetch(`${BASE}/deep-dive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await readError(res)
  return res.json()
}

export async function getHistory() {
  const res = await fetch(`${BASE}/history`)
  if (!res.ok) throw await readError(res)
  return res.json()
}

export async function getAnalysis(id) {
  const res = await fetch(`${BASE}/analysis/${id}`)
  if (!res.ok) throw await readError(res)
  return res.json()
}

export async function getDeepDive(id) {
  const res = await fetch(`${BASE}/deep-dive/${id}`)
  if (!res.ok) throw await readError(res)
  return res.json()
}

export async function toggleTask(taskId, isCompleted) {
  const res = await fetch(`${BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_completed: isCompleted }),
  })
  if (!res.ok) throw await readError(res)
  return res.json()
}
