import { useCallback, useEffect, useState } from 'react'
import { PhoneCall, Check } from 'lucide-react'
import { fetchCallbackRequests, markCallbackDone } from '../api'

// Customers who asked the WhatsApp bot for a human call back — the fallback
// for anyone the voice pipeline couldn't serve. Renders nothing while the
// queue is empty, so it only takes up space when someone is actually waiting.
function CallbackRequests({ token, onSessionExpired }) {
  const [requests, setRequests] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setRequests(await fetchCallbackRequests(token))
      setError('')
    } catch (err) {
      if (err.code === 'UNAUTHORIZED') onSessionExpired()
    }
  }, [token, onSessionExpired])

  useEffect(() => {
    load()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 15000)
    return () => clearInterval(interval)
  }, [load])

  async function handleDone(id) {
    const previous = requests
    setRequests((prev) => prev.filter((r) => r.id !== id))
    try {
      await markCallbackDone(token, id)
    } catch (err) {
      setRequests(previous)
      if (err.code === 'UNAUTHORIZED') onSessionExpired()
      else setError('Could not update that request. Please try again.')
    }
  }

  if (requests.length === 0 && !error) return null

  return (
    <section
      aria-labelledby="callbacks-heading"
      className="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-4"
    >
      <h2 id="callbacks-heading" className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
        <PhoneCall size={16} /> Call-back requests ({requests.length})
      </h2>
      <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
        These customers asked the bot for a person to call them — often because it couldn&apos;t understand their voice note.
      </p>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
      <ul className="mt-3 space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 rounded-md bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 px-3 py-2">
            <div className="text-sm">
              <span className="font-medium text-slate-800 dark:text-slate-100">{r.customer_contact}</span>
              <span className="text-slate-500 dark:text-slate-400"> · speaks {r.language === 'twi' ? 'Twi' : 'English'} · asked {r.created_at}</span>
            </div>
            <button
              onClick={() => handleDone(r.id)}
              className="flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-400 hover:underline"
            >
              <Check size={14} /> Called
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default CallbackRequests
