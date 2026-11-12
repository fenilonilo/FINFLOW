import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TransactionForm from './TransactionForm'
import Sheet from './Sheet'
import type { Transaction } from '@/types/models'

vi.mock('@/contexts/PeriodContext', () => ({ usePeriod: () => ({ year: 2026, month: 11 }) }))

const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results })
const pm = (id: number, name: string, extra = {}) => ({
  id,
  name,
  icon: 'x',
  color: '#fff',
  is_default: false,
  is_archived: false,
  card_function: null,
  card_detail: null,
  ...extra,
})
let posted: Record<string, unknown> | null = null
const server = setupServer(
  http.get('*/api/v1/categories/', () =>
    HttpResponse.json(
      page([
        {
          id: 1,
          name: 'Compras',
          icon: 'x',
          color: '#fff',
          parent: null,
          monthly_budget: null,
          is_default: false,
          is_archived: false,
          transaction_count: 0,
        },
      ]),
    ),
  ),
  http.get('*/api/v1/payment-methods/', () =>
    HttpResponse.json(
      page([
        pm(1, 'Pix'),
        pm(2, 'Nubank crédito', {
          card_function: 'credit',
          card_detail: { id: 9, name: 'Nubank', color: '#820ad1', closing_day: 5 },
        }),
      ]),
    ),
  ),
  http.post('*/api/v1/transactions/', async ({ request }) => {
    posted = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: 99, ...posted }, { status: 201 })
  }),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  posted = null
})
afterAll(() => server.close())

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('TransactionForm', () => {
  it('sem valor mostra erro e não chama a API', async () => {
    wrap(<TransactionForm onDone={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Descrição'), 'Teste')
    await userEvent.click(screen.getByText('Salvar lançamento'))
    expect(await screen.findByText('Informe o valor')).toBeInTheDocument()
    expect(posted).toBeNull()
  })

  it('envia "1.234,56" como "1234.56"', async () => {
    const onDone = vi.fn()
    wrap(<TransactionForm onDone={onDone} />)
    await userEvent.type(screen.getByLabelText('Valor'), '1.234,56')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Cadeira')
    await userEvent.click(screen.getByText('Salvar lançamento'))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(posted).toMatchObject({ amount: '1234.56', type: 'expense', description: 'Cadeira' })
  })

  it('crédito com fechamento dia 5 em 12/11 cai na fatura de dezembro e envia parcelas', async () => {
    wrap(<TransactionForm onDone={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-11-12' } })
    await userEvent.click(await screen.findByText('Nubank crédito'))
    expect(screen.getByText('cai na fatura de dezembro')).toBeInTheDocument()
    await userEvent.click(screen.getByText('3×'))
    await userEvent.type(screen.getByLabelText('Valor'), '300')
    await userEvent.type(screen.getByLabelText('Descrição'), 'TV')
    await userEvent.click(screen.getByText('Salvar lançamento'))
    await waitFor(() =>
      expect(posted).toMatchObject({ amount: '300.00', installments: 3, payment_method: 2 }),
    )
  })

  it('modo edição mostra Excluir e oculta parcelas', async () => {
    const tx = {
      id: 5,
      type: 'expense',
      kind: 'variable',
      category: null,
      category_detail: null,
      description: 'X',
      amount: '10.00',
      date: '2026-11-03',
      year: 2026,
      month: 11,
      payment_method: 2,
      payment_method_detail: null,
      is_paid: false,
      recurring_source: null,
      is_fixed: false,
      installment_current: null,
      installment_total: null,
    } as Transaction
    wrap(<TransactionForm tx={tx} onDone={vi.fn()} />)
    expect(screen.getByText('Excluir')).toBeInTheDocument()
    await screen.findByText('Nubank crédito')
    expect(screen.queryByText('Parcelas')).toBeNull()
  })
})

describe('Sheet', () => {
  it('Esc dentro de input e clique no scrim fecham', async () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Novo lançamento">
        <input aria-label="a" />
      </Sheet>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    await userEvent.type(screen.getByLabelText('a'), '{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByTestId('scrim'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
