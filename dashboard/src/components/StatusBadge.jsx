const statusStyles = {
  received: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
}

const statusLabels = {
  received: 'Received',
  under_review: 'Under Review',
  resolved: 'Resolved',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  )
}

export default StatusBadge