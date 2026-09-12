import { useState } from 'react'
import { sampleCases } from './data/sampleCases'
import SummaryCard from './components/SummaryCard'
import Filters from './components/Filters'
import CasesTable from './components/CasesTable'
import CaseDetailsModal from './components/CaseDetailsModal'

function App() {
  const [cases, setCases] = useState(sampleCases)
  const [selectedCase, setSelectedCase] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

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

  const filteredCases = cases.filter(c => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || c.fraud_category === categoryFilter
    return matchesStatus && matchesCategory
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-800">
            MTN Fraud Case Management Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            View, filter, and manage reported fraud cases
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Cases" count={totalCases} accentColor="text-slate-800" />
          <SummaryCard label="Received" count={receivedCount} accentColor="text-yellow-600" />
          <SummaryCard label="Under Review" count={underReviewCount} accentColor="text-blue-600" />
          <SummaryCard label="Resolved" count={resolvedCount} accentColor="text-green-600" />
        </div>

        <Filters
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
        />

        <CasesTable cases={filteredCases} onViewDetails={setSelectedCase} />
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