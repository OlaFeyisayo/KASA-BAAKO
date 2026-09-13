function SummaryCard({ label, count, accentColor }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${accentColor}`}>{count}</p>
    </div>
  )
}

export default SummaryCard