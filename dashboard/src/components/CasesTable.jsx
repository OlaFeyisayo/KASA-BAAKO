import StatusBadge from './StatusBadge'
function CasesTable({ cases, onViewDetails }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mt-6">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
          <tr>
            <th className="px-4 py-3">Case ID</th>
            <th className="px-4 py-3">Customer Contact</th>
            <th className="px-4 py-3">Channel</th>
            <th className="px-4 py-3">Input Mode</th>
            <th className="px-4 py-3">Fraud Category</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Incident Date</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cases.map((c) => (
            <tr key={c.case_id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{c.case_id}</td>
              <td className="px-4 py-3">{c.customer_contact}</td>
              <td className="px-4 py-3 capitalize">{c.channel}</td>
              <td className="px-4 py-3 capitalize">{c.input_mode}</td>
              <td className="px-4 py-3">{c.fraud_category}</td>
              <td className="px-4 py-3">GHS {c.amount.toFixed(2)}</td>
              <td className="px-4 py-3">{c.incident_date}</td>
              <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
              <td className="px-4 py-3">
               <button
  onClick={() => onViewDetails(c)}
  className="text-blue-600 hover:underline font-medium"
>
  View Details
</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CasesTable