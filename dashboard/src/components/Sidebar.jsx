import { LayoutDashboard, FolderKanban, Bell, FileText, Settings, ShieldAlert } from 'lucide-react'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Cases', icon: FolderKanban },
  { label: 'Fraud Alerts', icon: Bell, badgeKey: 'alertCount' },
  { label: 'Reports', icon: FileText },
  { label: 'Settings', icon: Settings },
]

function Sidebar({ activeItem = 'Dashboard', alertCount = 0, staffName = 'MTN Staff', staffRole = 'Case Officer' }) {
  return (
    <aside className="w-56 shrink-0 bg-slate-900 dark:bg-black text-slate-300 flex flex-col h-screen sticky top-0 px-4 py-5">
      <div className="w-10 h-10 rounded-full border-2 border-yellow-400 flex items-center justify-center text-yellow-400 font-bold text-[10px] mb-4">
        MTN
      </div>

      <div className="flex items-center gap-2 mb-8">
        <ShieldAlert size={18} className="text-yellow-400" />
        <div>
          <div className="text-white font-semibold text-sm leading-tight">KasaBaako</div>
          <div className="text-slate-500 text-[11px] leading-tight">Fraud Reporting System</div>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map(({ label, icon: Icon, badgeKey }) => {
          const isActive = activeItem === label
          const badge = badgeKey === 'alertCount' ? alertCount : null
          return (
            <button
              key={label}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-yellow-400 text-slate-900'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon size={17} />
                {label}
              </span>
              {!!badge && (
                <span className="bg-red-500 text-white text-[10px] font-semibold w-5 h-5 rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-slate-800 pt-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center text-xs font-semibold">
          {staffName.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <div className="text-white text-xs font-medium leading-tight">{staffName}</div>
          <div className="text-slate-500 text-[11px] leading-tight">{staffRole}</div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar