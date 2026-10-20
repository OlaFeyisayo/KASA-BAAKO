import { useState } from 'react'
import { checkNumber } from '../api'

function NumberCheck({ token, onSessionExpired }) {
  const [number, setNumber] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!number.trim()) return
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const data = await checkNumber(token, number.trim())
      setResult(data)
    } catch (err) {
      if (err.code === 'UNAUTHORIZED') {
        onSessionExpired()
      } else {
        setError('Could not check this number. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mt-6 p-5">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Check a Phone Number</h2>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="e.g. 0551234567"
          className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-md px-3 py-2 text-sm flex-1"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-60"
        >
          {loading ? 'Checking…' : 'Check'}
        </button>
      </form>

      {error && <p className="text-red-600 dark:text-red-400 text-sm mt-3" role="alert">{error}</p>}

      {result && (
        <div
          className={`mt-3 text-sm rounded-md px-3 py-2 ${
            result.high_alert
              ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
              : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <p>
            <span className="font-medium">{result.number}</span> has been reported{' '}
            <span className="font-semibold">{result.report_count}</span>{' '}
            time{result.report_count === 1 ? '' : 's'}.
            {result.high_alert && ' ⚠️ High alert — crosses the mass-warning threshold.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default NumberCheck
