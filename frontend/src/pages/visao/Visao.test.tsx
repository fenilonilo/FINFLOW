import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { handlers } from '@/mocks/handlers'
import { PeriodProvider } from '@/contexts/PeriodContext'
import Visao from './Visao'

const B = '/api/v1'
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PeriodProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Visao />
        </MemoryRouter>
      </PeriodProvider>
    </QueryClientProvider>,
  )
}

describe('Visao', () => {
  it('renderiza 13 barras e a última é projetada', async () => {
    const { container } = setup()
    await screen.findByText(/custou/)
    await screen.findAllByText('Onde foi o variável')
    const cols = await waitCols(container)
    expect(cols).toHaveLength(13)
    expect(cols[12].getAttribute('data-projected')).toBe('true')
    expect(cols[11].getAttribute('data-projected')).toBeNull()
  })

  it('clicar em outubro troca a frase; tabela acessível tem 13 linhas', async () => {
    const { container } = setup()
    await screen.findByText(/custou/)
    const cols = await waitCols(container)
    const oct = cols.find(c => c.getAttribute('data-month')!.endsWith('-10'))!
    fireEvent.click(oct)
    expect(await screen.findByText(/Outubro custou/)).toBeInTheDocument()
    const table = container.querySelector('table')!
    expect(within(table).getAllByRole('row')).toHaveLength(14) // 13 + cabeçalho
    expect(table.querySelectorAll('tbody tr')).toHaveLength(13)
  })

  it('mês projetado mostra "deve fechar perto de"', async () => {
    const { container } = setup()
    const cols = await waitCols(container)
    fireEvent.click(cols[12])
    expect(await screen.findByText(/deve fechar perto de/)).toBeInTheDocument()
  })

  it('com apenas 1 mês de dados não lança', async () => {
    server.use(http.get(`${B}/months/:year/:month/summary/`, ({ params }) => {
      const now = new Date()
      if (Number(params.month) !== now.getMonth() + 1) return new HttpResponse(null, { status: 500 })
      return HttpResponse.json({
        year: Number(params.year), month: Number(params.month), total_income: '9800.00', total_expense: '3000.00',
        total_fixed: '2000.00', total_variable: '1000.00', total_invested: '0.00', balance: '6800.00',
        pending_count: 0, investment_goal: '0.00', by_category: [], by_payment_method: [],
      })
    }))
    const { container } = setup()
    expect(await screen.findByText(/custou/)).toBeInTheDocument()
    expect(await screen.findByText('Primeiro mês do histórico.')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-month]').length).toBe(2)
  })
})

async function waitCols(container: HTMLElement) {
  await waitFor(() => expect(container.querySelectorAll('[data-month]')).toHaveLength(13))
  return [...container.querySelectorAll('[data-month]')]
}
