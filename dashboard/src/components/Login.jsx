import { useState } from 'react'

function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (password === 'mtn2026') {
      setError('')
      onLogin()
    } else {
      setError('Incorrect password. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-8 w-full max-w-sm"
      >
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">MTN Agent Login</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Fraud Case Management Dashboard</p>

        <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-md px-3 py-2 text-sm mb-2"
          placeholder="Enter password"
          autoFocus
        />

        {error && <p className="text-red-600 text-sm mb-2" role="alert">{error}</p>}

        <button
          type="submit"
          className="w-full bg-yellow-500 text-slate-900 font-medium rounded-md px-4 py-2 mt-2 hover:bg-yellow-400"
        >
          Log In
        </button>
      </form>
    </div>
  )
}

export default Login