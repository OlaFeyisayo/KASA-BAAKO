import StatusBadge from './StatusBadge'
import { formatAmount } from '../utils/formatAmount'
function CaseDetailsModal({ caseData, onClose, onStatusChange }) {
  if (!caseData) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">
            Case {caseData.case_id}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 text-sm">
       <StatusBadge status={caseData.status} />
          <p><span className="font-medium text-slate-500">Customer Contact:</span> {caseData.customer_contact}</p>
          <p><span className="font-medium text-slate-500">Channel:</span> {caseData.channel}</p>
          <p><span className="font-medium text-slate-500">Input Mode:</span> {caseData.input_mode}</p>
          <p><span className="font-medium text-slate-500">Language:</span> {caseData.language}</p>
          <p><span className="font-medium text-slate-500">Incident Summary:</span> {caseData.incident_summary}</p>
          <p><span className="font-medium text-slate-500">Incident Date:</span> {caseData.incident_date}</p>
          <p><span className="font-medium text-slate-500">Amount:</span> {formatAmount(caseData.amount)}</p>
          <p><span className="font-medium text-slate-500">Fraud Category:</span> {caseData.fraud_category}</p>
          <p><span className="font-medium text-slate-500">Suspected Number:</span> {caseData.suspected_number || 'Not provided'}</p>
          <p><span className="font-medium text-slate-500">Transaction ID:</span> {caseData.transaction_id || 'Not provided'}</p>
          <p><span className="font-medium text-slate-500">Created At:</span> {caseData.created_at}</p>

          <div className="pt-2">
            <label className="font-medium text-slate-500 block mb-2">Status:</label>
            <select
              value={caseData.status}
              onChange={(e) => onStatusChange(caseData.case_id, e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="received">Received</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div className="pt-2">
            <p className="font-medium text-slate-500 mb-2">Audio Recording:</p>
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

        <div className="border-t border-slate-200 px-6 py-4">
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