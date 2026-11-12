import { useAuth } from '@/contexts/AuthContext'
import MonthPicker from '@/components/ui/MonthPicker'

export default function Topbar() {
  const { user, logout } = useAuth()

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-subtle bg-surface px-6">
      <MonthPicker />
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-muted">{user?.first_name}</span>
        <button
          onClick={() => void logout()}
          className="rounded-lg px-3 py-1.5 text-xs text-text-muted hover:bg-elevated hover:text-text-primary transition-colors"
        >
          Sair
        </button>
      </div>
    </header>
  )
}
