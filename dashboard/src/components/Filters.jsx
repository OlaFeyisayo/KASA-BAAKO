const categories = [
  'Mobile Money Fraud',
  'Impersonation',
  'Phishing',
  'SIM Swap Fraud',
  'OTP Scam',
  'Unauthorized Transaction',
  'Other'
]

function Filters({
  statusFilter, setStatusFilter,
  categoryFilter, setCategoryFilter,
  searchQuery, setSearchQuery
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-6">
      <div>
        <label htmlFor="case-search" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Search Case ID
        </label>
        <input
          id="case-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="e.g. FC-1001"
          className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md px-3 py-2 text-sm bg-white w-full sm:w-48"
        />
      </div>

      <div>
        <label htmlFor="status-filter" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Status
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="all">All</option>
          <option value="received">Received</option>
          <option value="under_review">Under Review</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div>
        <label htmlFor="category-filter" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Fraud Category
        </label>
        <select
          id="category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default Filters