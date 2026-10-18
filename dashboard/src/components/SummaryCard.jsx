const icons = {
  total: (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      <path d="M3 5.5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 17 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9Z" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M3 8h14" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  received: (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      <path d="M10 3v8m0 0 3.5-3.5M10 11l-3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 13v1.5A2.5 2.5 0 0 0 5.5 17h9a2.5 2.5 0 0 0 2.5-2.5V13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  review: (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M10 6.5V10l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  resolved: (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      <path d="M4 10.5 8 14l8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
}

const accentBorder = {
  total: 'border-t-slate-400 dark:border-t-slate-500',
  received: 'border-t-yellow-500',
  review: 'border-t-blue-500',
  resolved: 'border-t-green-500',
}

function SummaryCard({ label, count, accentColor, icon = 'total', index = 0 }) {
  return (
    <div
      className={`animate-kpi-in bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 border-t-2 ${accentBorder[icon]} shadow-sm p-5 transition-transform transition-shadow duration-150 hover:-translate-y-0.5 hover:shadow-md`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <span className={accentColor}>{icons[icon]}</span>
      </div>
      <p className={`text-3xl font-bold mt-2 tabular-nums ${accentColor}`}>{count}</p>
    </div>
  )
}

export default SummaryCard
