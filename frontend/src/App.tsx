import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import AppShell, { useBodyScreen } from '@/components/shell/AppShell'
import BullBackground from '@/components/bull/BullBackground'
import Login from '@/pages/Login'
import Lancamentos from '@/pages/lanc/Lancamentos'
import Importar from '@/pages/Importar'
import Visao from '@/pages/visao/Visao'
import Conta from '@/pages/Conta'
import Ajustes from '@/pages/ajustes/Ajustes'

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
        <Route path="/import" element={<Importar />} />
        <Route path="/overview" element={<Visao />} />
        <Route path="/settings" element={<Navigate to="/settings/categories" replace />} />
        <Route path="/settings/:tab" element={<Ajustes />} />
        <Route path="/account" element={<Navigate to="/account/profile" replace />} />
        <Route path="/account/:tab" element={<Conta />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
