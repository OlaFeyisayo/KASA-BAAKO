import { useEffect, useMemo, useState } from 'react'
import StatusBadge from './StatusBadge'

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
  const [currentPage, setCurrentPage] = useState(1)
  const [casesPerPage, setCasesPerPage] = useState(10)

  // Reset to page 1 when the number of cases changes
  useEffect(() => {
    setCurrentPage(1)
  }, [cases.length])

  const totalPages = Math.ceil(cases.length / casesPerPage)

  // Make sure the current page is still valid
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const currentCases = useMemo(() => {
    const startIndex = (currentPage - 1) * casesPerPage
    const endIndex = startIndex + casesPerPage

    return cases.slice(startIndex, endIndex)
  }, [cases, currentPage, casesPerPage])

  const handleCasesPerPageChange = (event) => {
    setCasesPerPage(Number(event.target.value))
    setCurrentPage(1)
  }

  const goToPage = (page) => {
    setCurrentPage(page)
  }

  if (cases.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mt-6 p-10 text-center">
        <p className="text-slate-400 dark:text-slate-500">
          No cases found matching your filters.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mt-6 overflow-x-auto">
      <table className="w-full min-w-225 text-sm text-left">
        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase text-xs">
          <tr>
            <SortableHeader
              label="Case ID"
              sortKey="case_id"
              sortConfig={sortConfig}
              onSort={onSort}
            />
            <th className="px-4 py-3">Customer Contact</th>
            <th className="px-4 py-3">Channel</th>
            <th className="px-4 py-3">Input Mode</th>
            <SortableHeader
              label="Fraud Category"
              sortKey="fraud_category"
              sortConfig={sortConfig}
              onSort={onSort}
            />
            <SortableHeader
              label="Amount"
              sortKey="amount"
              sortConfig={sortConfig}
              onSort={onSort}
            />
            <SortableHeader
              label="Incident Date"
              sortKey="incident_date"
              sortConfig={sortConfig}
              onSort={onSort}
            />
            <SortableHeader
              label="Status"
              sortKey="status"
              sortConfig={sortConfig}
              onSort={onSort}
            />
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {currentCases.map((c) => (
            <tr
              key={c.case_id}
              className="hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                {c.case_id}
              </td>

              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                {c.customer_contact}
              </td>

              <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-300">
                {c.channel}
              </td>

              <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-300">
                {c.input_mode}
              </td>

              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                {c.fraud_category}
              </td>

              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                GHS {Number(c.amount).toFixed(2)}
              </td>

              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                {c.incident_date}
              </td>

              <td className="px-4 py-3">
                <StatusBadge status={c.status} />
              </td>

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

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-slate-200 dark:border-slate-700">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Showing{' '}
          {Math.min((currentPage - 1) * casesPerPage + 1, cases.length)}
          {' - '}
          {Math.min(currentPage * casesPerPage, cases.length)}
          {' of '}
          {cases.length} cases
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Previous
          </button>

          {Array.from({ length: totalPages }, (_, index) => index + 1).map(
            (page) => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className={`px-3 py-1.5 text-sm rounded border ${
                  currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {page}
              </button>
            )
          )}

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Next
          </button>

          <select
            value={casesPerPage}
            onChange={handleCasesPerPageChange}
            className="ml-2 px-2 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
          >
            <option value="10">10 per page</option>
            <option value="20">20 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default CasesTable