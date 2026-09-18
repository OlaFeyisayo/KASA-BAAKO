import { useEffect, useRef, useState } from 'react'
import { X, Phone, MessageCircle, Smartphone, Clock, ShieldAlert, DollarSign, Mic, AlertTriangle, Globe } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { formatAmount } from '../utils/formatAmount'
import { fetchCaseAudioUrl } from '../api'

function CaseDetailsModal({ caseData, onClose, onStatusChange, token, isFraudAlert, relatedCount }) {
  const modalRef = useRef(null)
  const previouslyFocusedRef = useRef(null)
  const [audioClips, setAudioClips] = useState([])
  const createdUrlsRef = useRef([])

  useEffect(() => {
    const refs = caseData?.audio_refs ?? []

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
            if (url) URL.revokeObjectURL(url)
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

  const ChannelIcon = caseData.channel === 'whatsapp' ? MessageCircle : Smartphone

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-modal-title"
        className="w-full max-w-[440px] h-full bg-white dark:bg-slate-900 overflow-y-auto outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 id="case-modal-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">Case Details</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="bg-yellow-400 text-slate-900 text-sm font-semibold px-3 py-1.5 rounded-full">{caseData.case_id}</span>
            {isFraudAlert && (
              <span className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs font-medium px-3 py-1.5 rounded-lg">
                <AlertTriangle size={13} /> This number/email appears in {relatedCount} other report{relatedCount === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div>
            <div className="text-slate-400 text-xs mb-1.5">Status</div>
            <StatusBadge status={caseData.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Phone size={16} className="text-slate-400 mt-0.5" />
              <div>
                <div className="text-slate-800 dark:text-slate-100 font-medium">{caseData.customer_contact}</div>
                <div className="text-slate-400 text-xs">Customer contact</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ChannelIcon size={16} className={caseData.channel === 'whatsapp' ? 'text-green-500 mt-0.5' : 'text-slate-400 mt-0.5'} />
              <div>
                <div className="text-slate-800 dark:text-slate-100 font-medium capitalize">{caseData.channel} · {caseData.input_mode}</div>
                <div className="text-slate-400 text-xs">Channel & input mode</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Globe size={16} className="text-slate-400 mt-0.5" />
              <div>
                <div className="text-slate-800 dark:text-slate-100 font-medium capitalize">{caseData.language}</div>
                <div className="text-slate-400 text-xs">Language</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock size={16} className="text-slate-400 mt-0.5" />
              <div>
                <div className="text-slate-800 dark:text-slate-100 font-medium">{caseData.incident_date}</div>
                <div className="text-slate-400 text-xs">Incident date</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldAlert size={16} className="text-yellow-500 mt-0.5" />
              <div>
                <div className="text-slate-800 dark:text-slate-100 font-medium">{caseData.fraud_category}</div>
                <div className="text-slate-400 text-xs">Fraud category</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <DollarSign size={16} className="text-slate-400 mt-0.5" />
              <div>
                <div className="text-slate-800 dark:text-slate-100 font-medium">{formatAmount(caseData.amount)}</div>
                <div className="text-slate-400 text-xs">Amount</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <div className="text-xs text-slate-400 mb-1">Suspected number</div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{caseData.suspected_number || 'Not provided'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <div className="text-xs text-slate-400 mb-1">Suspected email</div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100 break-all">{caseData.suspected_email || 'Not provided'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <div className="text-xs text-slate-400 mb-1">Transaction ID</div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{caseData.transaction_id || 'Not provided'}</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Customer report</div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {caseData.incident_summary}
            </div>
            <div className="text-xs text-slate-400 mt-2">Created {caseData.created_at}</div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              <Mic size={15} /> {audioClips.length > 1 ? 'Voice recordings' : 'Voice recording'}
            </div>

            {audioClips.length === 0 && (
              <p className="text-slate-400 italic text-sm">No audio recording available.</p>
            )}

            <div className="space-y-2">
              {audioClips.map((clip, index) => (
                <div key={index}>
                  {audioClips.length > 1 && (
                    <p className="text-xs text-slate-400 mb-1">Recording {index + 1}</p>
                  )}
                  {clip.state === 'loading' && (
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm text-slate-400 italic">
                      Loading audio…
                    </div>
                  )}
                  {clip.state === 'ready' && (
                    <div className="bg-slate-900 rounded-xl p-3">
                      <audio controls className="w-full h-9" src={clip.url}>
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                  {clip.state === 'error' && (
                    <p className="text-red-500 italic text-sm">Could not load this recording (it may have expired).</p>
                  )}
                  {clip.state === 'none' && (
                    <p className="text-slate-400 italic text-sm">Recording no longer available.</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Update status</div>
            <div className="flex gap-2">
              <label htmlFor="status-select" className="sr-only">Case status</label>
              <select
                id="status-select"
                value={caseData.status}
                onChange={(e) => onStatusChange(caseData.case_id, e.target.value)}
                className="flex-1 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 text-sm"
              >
                <option value="received">Received</option>
                <option value="under_review">Under Review</option>
                <option value="resolved">Resolved</option>
              </select>
              <button onClick={onClose} className="bg-yellow-400 text-slate-900 font-medium text-sm px-5 rounded-lg">
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CaseDetailsModal