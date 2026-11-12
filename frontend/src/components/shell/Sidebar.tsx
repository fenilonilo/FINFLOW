import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Lançamentos', key: '1', end: true, d: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/import', label: 'Importar', key: '2', d: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2' },
  { to: '/overview', label: 'Visão', key: '3', d: 'M4 20V10m6 10V4m6 16v-7m4 7H3' },
  { to: '/settings', label: 'Ajustes', key: '4', d: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10l2.1 2.1M4.9 19.1L7 17m10-10l2.1-2.1' },
]

const ACTIVE =
  'bg-g/[.08] text-tx shadow-[inset_0_0_0_1px_rgba(126,224,138,.16)] before:absolute before:-left-2.5 before:top-1/2 before:-mt-2 before:h-4 before:w-[3px] before:rounded-[3px] before:bg-g before:shadow-[0_0_12px_#7ee08a] before:content-[""]'

export default function Sidebar() {
  return (
    <nav className="flex w-[206px] flex-none flex-col gap-1">
      <div className="mb-[30px] ml-2 mt-0.5 font-display text-[28px] tracking-[.02em]">
        Fin<b className="font-[inherit] text-g">flow</b>
      </div>
      {ITEMS.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.end}
          className={({ isActive }) =>
            `relative flex items-center gap-3 rounded-xl px-3 py-[11px] text-sm font-medium transition-colors ${
              isActive ? ACTIVE : 'text-mu hover:bg-white/[.03] hover:text-tx'
            }`
          }
        >
          <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-none stroke-current stroke-[1.6]" strokeLinecap="round" strokeLinejoin="round">
            <path d={i.d} />
          </svg>
          {i.label}
          <kbd className="ml-auto rounded-[5px] border border-white/[.08] px-[5px] py-px font-sans text-[10px] font-medium text-mu">{i.key}</kbd>
        </NavLink>
      ))}
      {/* TODO Task 9: <ProfileCard /> */}
      <div data-testid="profile-slot" className="mt-auto h-[290px] w-[206px]" />
    </nav>
  )
}
