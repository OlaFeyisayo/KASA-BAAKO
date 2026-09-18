import { useState, useEffect, useCallback } from 'react'
import { fetchCases, updateCaseStatus, logout as apiLogout } from './api'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import SummaryCard from './components/SummaryCard'
import Filters from './components/Filters'
import CasesTable from './components/CasesTable'
import CaseDetailsModal from './components/CaseDetailsModal'
import { FileText, Inbox, Eye, CheckCircle2 } from 'lucide-react'

const TOKEN_STORAGE_KEY = 'kasabaako_dashboard_token'

function readStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
    else sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Not persisted across a refresh, but the session still works for this tab load.
  }
}

function App() {
  const [token, setToken] = useState(readStoredToken)
  const [darkMode, setDarkMode] = useState(false)
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selectedCase, setSelectedCase] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const handleSessionExpired = useCallback(() => {
    storeToken(null)
    setToken(null)
    setCases([])
  }, [])

  const loadCases = useCallback(async (activeToken, { silent = false } = {}) => {
    if (!silent) setLoading(true)
    setLoadError('')
    try {
      const data = await fetchCases(activeToken)
      setCases(data)
    } catch (err) {
      if (err.code === 'UNAUTHORIZED') {
        handleSessionExpired()
      } else if (!silent) {
        setLoadError('Could not load cases from the server. Please try again.')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [handleSessionExpired])

  useEffect(() => {
    if (token) loadCases(token)
  }, [token, loadCases])

  useEffect(() => {
    if (!token) return
    const POLL_INTERVAL_MS = 15000
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadCases(token, { silent: true })
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [token, loadCases])

  if (!token) {
    return (
      <Login
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onLogin={(newToken) => {
          storeToken(newToken)
          setToken(newToken)
        }}
      />
    )
  }

  async function handleLogout() {
    await apiLogout(token)
    handleSessionExpired()
  }

  const totalCases = cases.length
  const receivedCount = cases.filter(c => c.status === 'received').length
  const underReviewCount = cases.filter(c => c.status === 'under_review').length
  const resolvedCount = cases.filter(c => c.status === 'resolved').length

  const numberCounts = cases.reduce((acc, c) => {
    if (c.suspected_number) acc[c.suspected_number] = (acc[c.suspected_number] || 0) + 1
    return acc
  }, {})
  const fraudNumbers = new Set(Object.keys(numberCounts).filter(n => numberCounts[n] > 1))
  const fraudAlertCount = cases.filter(c => fraudNumbers.has(c.suspected_number)).length

  async function handleStatusChange(caseId, newStatus) {
    const previousCases = cases
    setCases(prevCases =>
      prevCases.map(c => (c.case_id === caseId ? { ...c, status: newStatus } : c))
    )
    setSelectedCase(prev => (prev && prev.case_id === caseId ? { ...prev, status: newStatus } : prev))
    try {
      await updateCaseStatus(token, caseId, newStatus)
    } catch (err) {
      setCases(previousCases)
      if (err.code === 'UNAUTHORIZED') {
        handleSessionExpired()
      } else {
        setLoadError('Could not update the case status. Please try again.')
      }
    }
  }

  function handleSort(key) {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  const filteredCases = cases.filter(c => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || c.fraud_category === categoryFilter
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch = c.case_id.toLowerCase().includes(q) || c.customer_contact.includes(searchQuery.trim())
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
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar activeItem="Dashboard" alertCount={fraudAlertCount} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar darkMode={darkMode} setDarkMode={setDarkMode} alertCount={fraudAlertCount} onLogout={handleLogout} />

        <main className="flex-1 px-6 py-6 overflow-x-auto">
          {loadError && (
            <div role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-4 py-3">
              {loadError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <SummaryCard label="Total Cases" count={totalCases} icon={FileText} iconBg="bg-slate-100 dark:bg-slate-800" iconColor="text-slate-600 dark:text-slate-300" />
            <SummaryCard label="Received" count={receivedCount} icon={Inbox} iconBg="bg-yellow-100 dark:bg-yellow-950" iconColor="text-yellow-600 dark:text-yellow-400" />
            <SummaryCard label="Under Review" count={underReviewCount} icon={Eye} iconBg="bg-blue-100 dark:bg-blue-950" iconColor="text-blue-600 dark:text-blue-400" />
            <SummaryCard label="Resolved" count={resolvedCount} icon={CheckCircle2} iconBg="bg-green-100 dark:bg-green-950" iconColor="text-green-600 dark:text-green-400" />
          </div>

          <Filters
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />

          {loading ? (
            <p className="mt-8 text-slate-500 dark:text-slate-400 text-sm">Loading cases…</p>
          ) : (
            <CasesTable
              cases={sortedCases}
              onViewDetails={setSelectedCase}
              sortConfig={sortConfig}
              onSort={handleSort}
              fraudNumbers={fraudNumbers}
            />
          )}
        </main>
      </div>

      <CaseDetailsModal
        caseData={selectedCase}
        onClose={() => setSelectedCase(null)}
        onStatusChange={handleStatusChange}
        isFraudAlert={selectedCase ? fraudNumbers.has(selectedCase.suspected_number) : false}
        relatedCount={selectedCase ? (numberCounts[selectedCase.suspected_number] || 1) - 1 : 0}
        token={token}
      />
    </div>
  )
}

export default App