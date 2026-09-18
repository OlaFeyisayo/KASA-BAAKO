const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// Login/logout now happen directly against Firebase (see firebase.js and
// Login.jsx) — the backend only ever sees the resulting ID token as a
// Bearer header, same as every call below.

export async function fetchCases(token) {
  const res = await fetch(`${API_BASE}/cases`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    const err = new Error('Session expired')
    err.code = 'UNAUTHORIZED'
    throw err
  }
  if (!res.ok) throw new Error('Failed to load cases')
  return res.json()
}

export async function fetchCaseAudioUrl(token, caseId, index) {
  const res = await fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}/audio/${index}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    const err = new Error('Session expired')
    err.code = 'UNAUTHORIZED'
    throw err
  }
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to load audio recording')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function updateCaseStatus(token, caseId, status) {
  const res = await fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  })
  if (res.status === 401) {
    const err = new Error('Session expired')
    err.code = 'UNAUTHORIZED'
    throw err
  }
  if (!res.ok) throw new Error('Failed to update case status')
  return res.json()
}