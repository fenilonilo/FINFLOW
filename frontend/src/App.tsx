import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import AppShell from '@/components/shell/AppShell'
import PageHeader from '@/components/shell/PageHeader'
import Login from '@/pages/Login'

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
const SettingsTab = () => <Placeholder eyebrow="Ajustes" title={useParams().tab ?? 'categories'} />
const AccountTab = () => <Placeholder eyebrow="Conta" title={useParams().tab ?? 'profile'} />

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Placeholder eyebrow="Lançamentos" title="Lançamentos" />} />
        <Route path="/import" element={<Placeholder eyebrow="Importar" title="Importar" />} />
        <Route path="/overview" element={<Placeholder eyebrow="Visão" title="Visão" />} />
        <Route path="/settings" element={<Navigate to="/settings/categories" replace />} />
        <Route path="/settings/:tab" element={<SettingsTab />} />
        <Route path="/account" element={<Navigate to="/account/profile" replace />} />
        <Route path="/account/:tab" element={<AccountTab />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
