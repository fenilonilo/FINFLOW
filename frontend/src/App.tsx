import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import AppShell, { useBodyScreen } from '@/components/shell/AppShell'
import PageHeader from '@/components/shell/PageHeader'
import BullBackground from '@/components/bull/BullBackground'
import Login from '@/pages/Login'
import Lancamentos from '@/pages/lanc/Lancamentos'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// TODO Tasks 11-16: replace with the real pages
const Placeholder = ({ eyebrow, title }: { eyebrow: string; title: string }) => <PageHeader eyebrow={eyebrow} title={title} />
const SETTINGS_TABS = ['categories', 'payments', 'cards', 'fixed']
const ACCOUNT_TABS = ['profile', 'devices']
const SettingsTab = () => {
  const tab = useParams().tab ?? ''
  return SETTINGS_TABS.includes(tab) ? <Placeholder eyebrow="Ajustes" title={tab} /> : <Navigate to="/settings/categories" replace />
}
const AccountTab = () => {
  const tab = useParams().tab ?? ''
  return ACCOUNT_TABS.includes(tab) ? <Placeholder eyebrow="Conta" title={tab} /> : <Navigate to="/account/profile" replace />
}

export default function App() {
  useBodyScreen()
  return (
    <>
    <BullBackground />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Lancamentos />} />
        <Route path="/import" element={<Placeholder eyebrow="Importar" title="Importar" />} />
        <Route path="/overview" element={<Placeholder eyebrow="Visão" title="Visão" />} />
        <Route path="/settings" element={<Navigate to="/settings/categories" replace />} />
        <Route path="/settings/:tab" element={<SettingsTab />} />
        <Route path="/account" element={<Navigate to="/account/profile" replace />} />
        <Route path="/account/:tab" element={<AccountTab />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
