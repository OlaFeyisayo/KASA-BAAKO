function ReportsView({ cases }) {
  const byCategory = cases.reduce((acc, c) => {
    const key = c.fraud_category || 'Other'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const byChannel = cases.reduce((acc, c) => {
    const key = c.channel || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const resolvedCount = cases.filter(c => c.status === 'resolved').length
  const resolutionRate = cases.length > 0 ? Math.round((resolvedCount / cases.length) * 100) : 0

  const totalAmount = cases.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)

  const categoryRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const channelRows = Object.entries(byChannel).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Resolution rate</p>
          <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{resolutionRate}%</p>
          <p className="text-xs text-slate-400 mt-1">{resolvedCount} of {cases.length} cases resolved</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total reported amount</p>
          <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">GHS {totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total cases</p>
          <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{cases.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">By fraud category</h3>
          {categoryRows.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No cases yet.</p>
          ) : (
            <ul className="space-y-2">
              {categoryRows.map(([category, count]) => (
                <li key={category} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{category}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">By reporting channel</h3>
          {channelRows.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No cases yet.</p>
          ) : (
            <ul className="space-y-2">
              {channelRows.map(([channel, count]) => (
                <li key={channel} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300 capitalize">{channel}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportsView
