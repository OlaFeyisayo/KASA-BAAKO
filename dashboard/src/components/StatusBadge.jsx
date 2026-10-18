const statusStyles = {
  received: 'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400',
  under_review: 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400',
  resolved: 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400',
}

const dotStyles = {
  received: 'bg-yellow-500',
  under_review: 'bg-blue-500',
  resolved: 'bg-green-500',
}

const statusLabels = {
  received: 'Received',
  under_review: 'Under Review',
  resolved: 'Resolved',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white dark:bg-slate-800 ${statusStyles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[status]} ${status === 'under_review' ? 'animate-dot-pulse' : ''}`} />
      {statusLabels[status]}
    </span>
  )
}

export default StatusBadge
