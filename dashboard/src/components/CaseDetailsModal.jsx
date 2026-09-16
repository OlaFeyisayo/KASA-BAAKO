import { useEffect, useRef, useState } from 'react'
import StatusBadge from './StatusBadge'
import { formatAmount } from '../utils/formatAmount'
import { fetchCaseAudioUrl } from '../api'

function CaseDetailsModal({ caseData, onClose, onStatusChange, token }) {
  const modalRef = useRef(null)
  const previouslyFocusedRef = useRef(null)
  // One entry per voice note in caseData.audio_refs (a case can have
  // several — the initial report, an answered follow-up, etc.), not just
  // the most recent one.
  const [audioClips, setAudioClips] = useState([]) // [{ url, state: 'loading' | 'ready' | 'none' | 'error' }]
  const createdUrlsRef = useRef([]) // tracks blob: URLs for cleanup, kept out of state so an in-progress fetch for clip 2 can't have clip 1's still-visible URL yanked out from under it

  // A WhatsApp media id isn't a playable URL on its own — fetch each
  // clip's actual bytes through our backend's proxy route (see api.js).
  useEffect(() => {
    const refs = caseData?.audio_refs ?? []

    // Release the previous case's blob URLs before fetching this one's.
    createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    createdUrlsRef.current = []

    if (refs.length === 0) {
      setAudioClips([])
      return
    }

    let cancelled = false
    setAudioClips(refs.map(() => ({ url: null, state: 'loading' })))

    refs.forEach((_, index) => {
      fetchCaseAudioUrl(token, caseData.case_id, index)
        .then((url) => {
          if (cancelled) {
            if (url) URL.revokeObjectURL(url) // modal moved on before this resolved
            return
          }
          if (url) createdUrlsRef.current.push(url)
          setAudioClips((prev) => {
            const next = [...prev]
            next[index] = url ? { url, state: 'ready' } : { url: null, state: 'none' }
            return next
          })
        })
        .catch(() => {
          if (!cancelled) {
            setAudioClips((prev) => {
              const next = [...prev]
              next[index] = { url: null, state: 'error' }
              return next
            })
          }
        })
    })

    return () => {
      cancelled = true
    }
  }, [caseData?.case_id, token])

  // Final cleanup on unmount (case-switch cleanup happens above instead,
  // since that needs to run before fetching the NEW case's clips).
  useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }

    if (caseData) {
      previouslyFocusedRef.current = document.activeElement
      modalRef.current?.focus()
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus()
      }
    }
  }, [caseData, onClose])

  if (!caseData) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-modal-title"
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto outline-none"
      >
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <h2 id="case-modal-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Case {caseData.case_id}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <StatusBadge status={caseData.status} />
          <p><span className="font-medium text-slate-500 dark:text-slate-400">Customer Contact:</span> {caseData.customer_contact}</p>
          <p><span className="font-medium text-slate-500 dark:text-slate-400">Channel:</span> {caseData.channel}</p>
          <p><span className="font-medium text-slate-500 dark:text-slate-400">Input Mode:</span> {caseData.input_mode}</p>
          <p><span className="font-medium text-slate-500 dark:text-slate-400">Language:</span> {caseData.language}</p>
          <p><span className="font-medium text-slate-500 dark:text-slate-400">Incident Summary:</span> {caseData.incident_summary}</p>
          <p><span className="font-medium text-slate-500 dark:text-slate-400">Incident Date:</span> {caseData.incident_date}</p>
          <p><span className="font-medium text-slate-500 dark:text-slate-400">Amount:</span> {formatAmount(caseData.amount)}</p>
          <p><span className="font-medium text-slate-500 dark:text-slate-400">Fraud Category:</span> {caseData.fraud_category}</p>
          <p><span className="font-medium text-slate-500 dark:text-slate-400">Suspected Number:</span> {caseData.suspected_number || 'Not provided'}</p>
          <p><span className="font-medium text-slate-500 dark:text-slate-400">Transaction ID:</span> {caseData.transaction_id || 'Not provided'}</p>
          <p><span className="font-medium text-slate-500 dark:text-slate-400">Created At:</span> {caseData.created_at}</p>

          <div className="pt-2">
            <label htmlFor="status-select" className="font-medium text-slate-500 dark:text-slate-400 block mb-2">
              Status:
            </label>
            <select
              id="status-select"
              value={caseData.status}
              onChange={(e) => onStatusChange(caseData.case_id, e.target.value)}
              className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-md px-3 py-2 text-sm"
            >
              <option value="received">Received</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="pt-2">
            <p className="font-medium text-slate-500 dark:text-slate-400 mb-2">
              {audioClips.length > 1 ? 'Audio Recordings:' : 'Audio Recording:'}
            </p>
            {audioClips.length === 0 && <p className="text-slate-400 italic">No audio recording available.</p>}
            <div className="space-y-2">
              {audioClips.map((clip, index) => (
                <div key={index}>
                  {audioClips.length > 1 && (
                    <p className="text-xs text-slate-400 mb-1">Recording {index + 1}</p>
                  )}
                  {clip.state === 'loading' && <p className="text-slate-400 italic">Loading audio…</p>}
                  {clip.state === 'ready' && (
                    <audio controls className="w-full" src={clip.url}>
                      Your browser does not support the audio element.
                    </audio>
                  )}
                  {clip.state === 'error' && (
                    <p className="text-red-500 italic">Could not load this recording (it may have expired).</p>
                  )}
                  {clip.state === 'none' && (
                    <p className="text-slate-400 italic">Recording no longer available.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4">
          <button
            onClick={onClose}
            className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default CaseDetailsModal