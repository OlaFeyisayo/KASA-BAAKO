import { Sun, Moon, Bell, LogOut } from 'lucide-react'

function TopBar({ staffFirstName, darkMode, setDarkMode, alertCount = 0, onLogout }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,'

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div>
        <p className="text-xs text-slate-400">{greeting}</p>
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{staffFirstName || 'MTN Staff'}</p>
      </div>
      <div className="flex items-center gap-5">
        <button
          onClick={() => setDarkMode(d => !d)}
          aria-label="Toggle dark mode"
          className="text-slate-500 dark:text-slate-300"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="relative">
          <Bell size={18} className="text-slate-500 dark:text-slate-300" />
          {alertCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
              {alertCount}
            </span>
          )}
        </div>
        <button onClick={onLogout} aria-label="Log out" className="text-slate-500 dark:text-slate-300">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}

export default TopBar