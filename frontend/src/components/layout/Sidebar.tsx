import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Upload, BarChart3, Settings } from 'lucide-react'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Lançamentos' },
  { to: '/import', icon: Upload, label: 'Importar' },
  { to: '/analytics', icon: BarChart3, label: 'Análise' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
]

export default function Sidebar() {
  return (
    <>
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-border-subtle bg-surface md:flex">
        <div className="flex h-16 items-center px-6">
          <span className="text-lg font-bold text-accent">FinFlow</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-muted hover:bg-elevated hover:text-text-primary'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border-subtle bg-surface px-2 py-2 md:hidden">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-xs transition-colors ${
                isActive ? 'text-accent' : 'text-text-muted'
              }`
            }
          >
            <Icon size={20} />
            <span className="truncate text-[10px]">{label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
