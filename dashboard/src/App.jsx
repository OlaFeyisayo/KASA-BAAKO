import { useState, useEffect } from 'react'
import { sampleCases } from './data/sampleCases'
import Login from './components/Login'
import SummaryCard from './components/SummaryCard'
import Filters from './components/Filters'
import CasesTable from './components/CasesTable'
import CaseDetailsModal from './components/CaseDetailsModal'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [cases, setCases] = useState(sampleCases)
  const [selectedCase, setSelectedCase] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />
  }

  const totalCases = cases.length
  const receivedCount = cases.filter(c => c.status === 'received').length
  const underReviewCount = cases.filter(c => c.status === 'under_review').length
  const resolvedCount = cases.filter(c => c.status === 'resolved').length

  function handleStatusChange(caseId, newStatus) {
    setCases(prevCases =>
      prevCases.map(c =>
        c.case_id === caseId ? { ...c, status: newStatus } : c
      )
    )
  }

  function handleSort(key) {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const filteredCases = cases.filter(c => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || c.fraud_category === categoryFilter
    const matchesSearch = c.case_id.toLowerCase().includes(searchQuery.trim().toLowerCase())
    return matchesStatus && matchesCategory && matchesSearch
  })

  const sortedCases = [...filteredCases].sort((a, b) => {
    if (!sortConfig.key) return 0

    let valA = a[sortConfig.key]
    let valB = b[sortConfig.key]

    if (typeof valA === 'string') valA = valA.toLowerCase()
    if (typeof valB === 'string') valB = valB.toLowerCase()

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              MTN Fraud Case Management Dashboard
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              View, filter, and manage reported fraud cases
            </p>
          </div>
          <button
            onClick={() => setDarkMode(d => !d)}
            className="text-sm border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Cases" count={totalCases} accentColor="text-slate-800 dark:text-slate-100" />
          <SummaryCard label="Received" count={receivedCount} accentColor="text-yellow-600" />
          <SummaryCard label="Under Review" count={underReviewCount} accentColor="text-blue-600" />
          <SummaryCard label="Resolved" count={resolvedCount} accentColor="text-green-600" />
        </div>

        <Filters
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        <CasesTable
          cases={sortedCases}
          onViewDetails={setSelectedCase}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      </main>

      <CaseDetailsModal
        caseData={selectedCase}
        onClose={() => setSelectedCase(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}

export default App