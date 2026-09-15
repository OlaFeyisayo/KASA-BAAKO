// Talks to the KasaBaako backend. Defaults to localhost:3000 for local dev;
// override with VITE_API_BASE_URL when the backend runs elsewhere.
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export async function login(password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) return null
  const { token } = await res.json()
  return token
}

export async function logout(token) {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // Best-effort — the local session is cleared either way.
  }
}

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
