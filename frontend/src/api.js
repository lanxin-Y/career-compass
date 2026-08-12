const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

async function readError(res) {
  try {
    return await res.json()
  } catch {
    return { detail: res.statusText || 'Request failed' }
  }
}

export async function analyzeGap(jdText, resumeFile, jobTitle, company, provider = 'claude') {
  const form = new FormData()
  form.append('jd_text', jdText)
  form.append('resume', resumeFile)
  form.append('provider', provider)
  if (jobTitle) form.append('job_title', jobTitle)
  if (company) form.append('company', company)
  const res = await fetch(`${BASE}/analyze`, { method: 'POST', body: form })
  if (!res.ok) throw await readError(res)
  return res.json()
}

export async function deepDive(
  analysisId,
  suggestionKey,
  userNotes,
  provider = 'claude',
) {
  const body = {
    analysis_id: analysisId,
    suggestion_key: String(suggestionKey),
    provider,
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

export async function updateAnalysisDeadline(id, deadline) {
  const res = await fetch(`${BASE}/analysis/${id}/deadline`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deadline: deadline || null }),
  })
  if (!res.ok) throw await readError(res)
  return res.json()
}

export async function getDeepDive(id) {
  const res = await fetch(`${BASE}/deep-dive/${id}`)
  if (!res.ok) throw await readError(res)
  return res.json()
}

export async function deleteDeepDive(id) {
  const res = await fetch(`${BASE}/deep-dive/${id}`, { method: 'DELETE' })
  if (!res.ok) throw await readError(res)
  return res.json()
}

export async function createManualPlan({ title, description, estimated_time, tasks }) {
  const res = await fetch(`${BASE}/plans/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, estimated_time, tasks }),
  })
  if (!res.ok) throw await readError(res)
  return res.json()
}

export async function getAllDeepDives() {
  const res = await fetch(`${BASE}/deep-dives`)
  if (!res.ok) throw await readError(res)
  return res.json()
}

export async function getAllTasks() {
  const res = await fetch(`${BASE}/all-tasks`)
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
