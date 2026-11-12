import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Sidebar from './Sidebar'

const GO: Record<string, string> = { '1': '/', '2': '/import', '3': '/overview', '4': '/settings' }

export function useBodyScreen() {
  const { pathname } = useLocation()
  const screen = screenOf(pathname)
  useEffect(() => {
    document.body.dataset.screen = screen
  }, [screen])
}

function screenOf(path: string) {
  if (path.startsWith('/import')) return 'imp'
  if (path.startsWith('/overview')) return 'visao'
  if (path.startsWith('/settings')) return 'ajustes'
  if (path.startsWith('/account')) return 'conta'
  if (path.startsWith('/login')) return 'login'
  return 'lanc'
}

export default function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return
      if (GO[e.key]) navigate(GO[e.key])
      else if (e.key.toLowerCase() === 'n' && pathname === '/') setParams((p) => { const n = new URLSearchParams(p); n.set('new', '1'); return n }, { replace: true })
      else if (e.key === 'Escape' && params.has('new')) {
        setParams((p) => { const n = new URLSearchParams(p); n.delete('new'); return n }, { replace: true })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, pathname, params, setParams])

  return (
    <div className="fixed inset-0 z-10 flex gap-[clamp(20px,2.2vw,44px)] px-[clamp(18px,2vw,36px)] py-[clamp(16px,2.4vh,28px)]">
      <Sidebar />
      <main className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-[60px] [scrollbar-width:none]">
        <div className="max-w-[max(1080px,calc(100vw-340px-30vw))]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
