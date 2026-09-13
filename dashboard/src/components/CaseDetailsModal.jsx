import { useEffect, useRef } from 'react'
import StatusBadge from './StatusBadge'
import { formatAmount } from '../utils/formatAmount'

function CaseDetailsModal({ caseData, onClose, onStatusChange }) {
  const modalRef = useRef(null)
  const previouslyFocusedRef = useRef(null)

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
            <p className="font-medium text-slate-500 dark:text-slate-400 mb-2">Audio Recording:</p>
            {caseData.audio_ref ? (
              <audio controls className="w-full">
                <source src={caseData.audio_ref} />
                Your browser does not support the audio element.
              </audio>
            ) : (
              <p className="text-slate-400 italic">No audio recording available.</p>
            )}
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