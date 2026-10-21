function SummaryCard({ label, count, icon: Icon, iconBg, iconColor }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
          <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{count}</p>
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
            <Icon size={18} className={iconColor} />
          </div>
        )}
      </div>
    </div>
  )
}

export default SummaryCard