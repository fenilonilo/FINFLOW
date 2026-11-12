/**
 * Smoke tests — uma renderização por tela do redesign, via MSW.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { handlers } from '@/mocks/handlers'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { ReactNode } from 'react'

import Lancamentos from '@/pages/lanc/Lancamentos'
import Importar from '@/pages/Importar'
import Visao from '@/pages/visao/Visao'
import Ajustes from '@/pages/ajustes/Ajustes'
import Conta from '@/pages/Conta'
import Login from '@/pages/Login'

import { AuthContext } from '@/contexts/AuthContext'
import { PeriodProvider } from '@/contexts/PeriodContext'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const mockUser = { id: 1, email: 'test@finflow.app', first_name: 'Test', avatar_url: null }

function renderAt(path: string, element: ReactNode, route = path, user: typeof mockUser | null = mockUser) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <AuthContext.Provider
      value={{ user, isLoading: false, login: async () => {}, logout: async () => {}, setUser: () => {} }}
    >
      <QueryClientProvider client={qc}>
        <PeriodProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={route} element={element} />
            </Routes>
          </MemoryRouter>
        </PeriodProvider>
      </QueryClientProvider>
    </AuthContext.Provider>,
  )
}

describe('Smoke das telas', () => {
  it('Lançamentos', async () => {
    renderAt('/', <Lancamentos />)
    expect(await screen.findByText('Lançamentos')).toBeInTheDocument()
  })

  it('Importar', async () => {
    renderAt('/import', <Importar />)
    expect(await screen.findByText('Importar')).toBeInTheDocument()
  })

  it('Visão (sem H1: eyebrow)', async () => {
    renderAt('/overview', <Visao />)
    expect(await screen.findByText('Visão · últimos 12 meses')).toBeInTheDocument()
  })

  it('Ajustes', async () => {
    renderAt('/settings/categories', <Ajustes />, '/settings/:tab')
    expect(await screen.findByText('Ajustes')).toBeInTheDocument()
  })

  it('Conta', async () => {
    renderAt('/account/profile', <Conta />, '/account/:tab')
    expect(await screen.findByText('Conta')).toBeInTheDocument()
  })

  it('Login', async () => {
    renderAt('/login', <Login />, '/login', null)
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })
})
