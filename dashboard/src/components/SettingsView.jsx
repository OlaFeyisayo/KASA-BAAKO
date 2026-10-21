import { Sun, Moon, LogOut, Mail, Server } from 'lucide-react'

function SettingsView({ staffEmail, darkMode, setDarkMode, onLogout, apiBaseUrl }) {
  return (
    <div className="max-w-xl space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">Account</h3>
        <div className="flex items-center gap-3">
          <Mail size={16} className="text-slate-400" />
          <div>
            <div className="text-sm text-slate-800 dark:text-slate-100">{staffEmail || 'Unknown'}</div>
            <div className="text-xs text-slate-400">Signed in via MTN staff login</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-4 flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
        >
          <LogOut size={15} /> Log out
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            {darkMode ? <Moon size={16} /> : <Sun size={16} />}
            Dark mode
          </div>
          <button
            onClick={() => setDarkMode(d => !d)}
            role="switch"
            aria-checked={darkMode}
            aria-label="Toggle dark mode"
            className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${darkMode ? 'bg-yellow-400 justify-end' : 'bg-slate-300 justify-start'}`}
          >
            <span className="w-4 h-4 bg-white rounded-full block" />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">System</h3>
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Server size={16} className="text-slate-400" />
          Connected backend: <span className="font-mono text-xs">{apiBaseUrl}</span>
        </div>
      </div>
    </div>
  )
}

export default SettingsView
