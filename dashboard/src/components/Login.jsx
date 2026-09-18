import { useState } from 'react'
import { login } from '../api'
import { Lock, Eye, EyeOff, MessageCircle, Smartphone, Sparkles, Sun, Moon, ShieldAlert } from 'lucide-react'

function Login({ onLogin, darkMode, setDarkMode }) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const token = await login(password)
      if (!token) {
        setError('Incorrect password. Please try again.')
        return
      }
      onLogin(token)
    } catch {
      setError('Could not reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-950">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 relative overflow-hidden flex-col justify-between p-10">
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-yellow-400 rounded-full opacity-90" />
        <div className="relative z-10 w-11 h-11 rounded-full border-2 border-yellow-400 flex items-center justify-center text-yellow-400 font-bold text-xs">
          MTN
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert size={26} className="text-yellow-400" />
            <h1 className="text-3xl font-bold text-white">Kasa<span className="text-yellow-400">Baako</span></h1>
          </div>
          <p className="text-slate-300 text-sm mb-8">Fraud Reporting System</p>

          <h2 className="text-2xl font-semibold text-white leading-snug mb-4">
            Report fraud. Protect your money.<br /><span className="text-yellow-400">Together.</span>
          </h2>
          <p className="text-slate-400 text-sm mb-8 max-w-sm leading-relaxed">
            KasaBaako helps MTN Ghana customers report mobile money fraud via WhatsApp or USSD. Our AI turns reports into structured cases, and our team works to resolve them quickly and safely.
          </p>

          <div className="flex gap-6">
            <div className="flex flex-col items-center gap-1.5">
              <MessageCircle size={18} className="text-yellow-400" />
              <span className="text-slate-300 text-xs text-center">WhatsApp<br />Report via chat</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Smartphone size={18} className="text-yellow-400" />
              <span className="text-slate-300 text-xs text-center">USSD<br />Voice, text, or menu</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Sparkles size={18} className="text-yellow-400" />
              <span className="text-slate-300 text-xs text-center">AI<br />Turns reports into cases</span>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-white font-medium text-sm">Every report makes a safer MTN.</p>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex justify-end items-center gap-2 px-8 py-6">
          <Sun size={15} className="text-slate-400" />
          <button
            onClick={() => setDarkMode(d => !d)}
            role="switch"
            aria-checked={darkMode}
            aria-label="Toggle dark mode"
            className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${darkMode ? 'bg-yellow-400 justify-end' : 'bg-slate-300 justify-start'}`}
          >
            <span className="w-4 h-4 bg-white rounded-full block" />
          </button>
          <Moon size={15} className="text-slate-400" />
        </div>

        <div className="flex-1 flex items-center justify-center px-8">
          <form onSubmit={handleSubmit} className="w-full max-w-sm">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">MTN Staff Login</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
              Access the KasaBaako fraud reporting system to manage and resolve cases.
            </p>

            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Staff Password
            </label>
            <div className="relative mb-3">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter shared staff password"
                required
                autoFocus
                className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg pl-10 pr-10 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && <p role="alert" className="text-red-600 text-sm mb-3">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-slate-900 font-semibold text-sm py-3 rounded-lg mt-3"
            >
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>

            <div className="flex items-center gap-3 my-8">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
              <span className="w-6 h-6 rounded-full border border-yellow-400 flex items-center justify-center text-yellow-500 font-bold text-[8px]">MTN</span>
              MTN Ghana · Better Connections. A Brighter Future.
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login