import StatusBadge from './StatusBadge'
import { formatAmount } from '../utils/formatAmount'

function SortableHeader({ label, sortKey, sortConfig, onSort }) {
  const isActive = sortConfig.key === sortKey
  const arrow = isActive ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''

  return (
    <th className="px-4 py-3">
      <button
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 uppercase text-xs font-medium hover:text-slate-700 dark:hover:text-slate-200"
      >
        {label} <span className="w-3 inline-block">{arrow}</span>
      </button>
    </th>
  )
}

function CasesTable({ cases, onViewDetails, sortConfig, onSort }) {
  if (cases.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mt-6 p-10 text-center">
        <p className="text-slate-400 dark:text-slate-500">No cases found matching your filters.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mt-6 overflow-x-auto">
      <table className="w-full min-w-225 text-sm text-left">
        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase text-xs">
          <tr>
            <SortableHeader label="Case ID" sortKey="case_id" sortConfig={sortConfig} onSort={onSort} />
            <th className="px-4 py-3">Customer Contact</th>
            <th className="px-4 py-3">Channel</th>
            <th className="px-4 py-3">Input Mode</th>
            <SortableHeader label="Fraud Category" sortKey="fraud_category" sortConfig={sortConfig} onSort={onSort} />
            <SortableHeader label="Amount" sortKey="amount" sortConfig={sortConfig} onSort={onSort} />
            <SortableHeader label="Incident Date" sortKey="incident_date" sortConfig={sortConfig} onSort={onSort} />
            <SortableHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={onSort} />
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {cases.map((c) => (
            <tr key={c.case_id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.case_id}</td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.customer_contact}</td>
              <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-300">{c.channel}</td>
              <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-300">{c.input_mode}</td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.fraud_category}</td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatAmount(c.amount)}</td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.incident_date}</td>
              <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onViewDetails(c)}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
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