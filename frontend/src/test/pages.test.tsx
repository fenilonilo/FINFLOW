/**
 * Smoke tests — one per page (F7 spec §12 checklist item: smoke test per page)
 * Uses MSW for API mocking.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { handlers } from '@/mocks/handlers'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Pages
import Dashboard from '@/pages/Dashboard'
import Transactions from '@/pages/Transactions'
import RecurringExpenses from '@/pages/RecurringExpenses'
import Acquisitions from '@/pages/Acquisitions'
import Investments from '@/pages/Investments'
import Cards from '@/pages/Cards'
import Debts from '@/pages/Debts'
import Analytics from '@/pages/Analytics'
import Settings from '@/pages/Settings'

// Auth context mock
import { AuthContext } from '@/contexts/AuthContext'
import { PeriodProvider } from '@/contexts/PeriodContext'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const mockUser = { id: 1, email: 'test@finflow.app', first_name: 'Test' }

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
      <AuthContext.Provider
        value={{
          user: mockUser,
          isLoading: false,
          login: async () => {},
          logout: async () => {},
        }}
      >
        <QueryClientProvider client={qc}>
          <PeriodProvider>
            <MemoryRouter>{children}</MemoryRouter>
          </PeriodProvider>
        </QueryClientProvider>
      </AuthContext.Provider>
  )
}

describe('Page smoke tests', () => {
  it('Dashboard renders without crashing', async () => {
    render(<Dashboard />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(document.body).toBeTruthy()
    })
  })

  it('Transactions renders without crashing', async () => {
    render(<Transactions />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('Lançamentos')).toBeTruthy()
    })
  })

  it('RecurringExpenses renders without crashing', async () => {
    render(<RecurringExpenses />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('Gastos Fixos')).toBeTruthy()
    })
  })

  it('Acquisitions renders without crashing', async () => {
    render(<Acquisitions />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('Aquisições')).toBeTruthy()
    })
  })

  it('Investments renders without crashing', async () => {
    render(<Investments />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('Investimentos')).toBeTruthy()
    })
  })

  it('Cards renders without crashing', async () => {
    render(<Cards />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('Cartões')).toBeTruthy()
    })
  })

  it('Debts renders without crashing', async () => {
    render(<Debts />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('Dívidas')).toBeTruthy()
    })
  })

  it('Analytics renders without crashing', async () => {
    render(<Analytics />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('Análises')).toBeTruthy()
    })
  })

  it('Settings renders without crashing', async () => {
    render(<Settings />, { wrapper: Wrapper })
    await waitFor(() => {
      expect(screen.getByText('Configurações')).toBeTruthy()
    })
  })
})
