const categories = [
  'Mobile Money Fraud',
  'Impersonation',
  'Phishing',
  'SIM Swap Fraud',
  'OTP Scam',
  'Unauthorized Transaction',
  'Other'
]

function Filters({ statusFilter, setStatusFilter, categoryFilter, setCategoryFilter }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-6">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="all">All</option>
          <option value="received">Received</option>
          <option value="under_review">Under Review</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Fraud Category</label>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
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