import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { handlers } from '@/mocks/handlers'
import { PeriodProvider } from '@/contexts/PeriodContext'
import Lancamentos from './Lancamentos'

const B = '/api/v1'
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const tx = (o: Record<string, unknown>) => ({
  type: 'expense', kind: 'variable', category: null, category_detail: null, payment_method: null, payment_method_detail: null,
  is_paid: false, recurring_source: null, is_fixed: false, installment_current: null, installment_total: null,
  year: 2026, month: 11, date: '2026-11-10', ...o,
})
const page = (results: unknown[]) => HttpResponse.json({ count: results.length, next: null, previous: null, results })
const withTxs = (results: unknown[]) => server.use(http.get(`${B}/transactions/`, () => page(results)))

const TXS = [
  tx({ id: 1, description: 'Seguro auto', amount: '594.30', is_fixed: true, kind: 'fixed', date: '2099-01-20' }),
  tx({ id: 2, description: 'Aluguel', amount: '1800.00', is_fixed: true, kind: 'fixed', is_paid: true }),
  tx({ id: 3, description: 'Mercado Extra', amount: '312.40', is_paid: true }),
  tx({ id: 4, description: 'Salário', amount: '9800.00', type: 'income', is_paid: true }),
]

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PeriodProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Lancamentos />
        </MemoryRouter>
      </PeriodProvider>
    </QueryClientProvider>,
  )
}

describe('Lancamentos', () => {
  it('renderiza os blocos principais', async () => {
    withTxs(TXS)
    setup()
    expect(await screen.findByText('Fixos previstos do mês')).toBeInTheDocument()
    expect(screen.getByText('Faturas abertas')).toBeInTheDocument()
    expect(screen.getByText('Próximos vencimentos')).toBeInTheDocument()
    expect(screen.getByText('Movimentações')).toBeInTheDocument()
  })

  it('clicar no chip pendente faz PATCH com is_paid true', async () => {
    withTxs(TXS)
    const patch = vi.fn()
    server.use(http.patch(`${B}/transactions/:id/`, async ({ request }) => { patch(await request.json()); return HttpResponse.json({}) }))
    setup()
    fireEvent.click(await screen.findByRole('button', { name: /Seguro auto/ }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith({ is_paid: true }))
  })

  it('Marcar fatura paga faz POST em pay-invoice', async () => {
    withTxs(TXS)
    const post = vi.fn()
    server.use(http.post(`${B}/cards/:id/pay-invoice/`, async ({ request }) => { post(await request.json()); return HttpResponse.json({}) }))
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar fatura paga' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ is_paid: true })))
  })

  it('so cartoes de credito entram no leque e limit null nao mostra Limite', async () => {
    withTxs(TXS)
    setup()
    expect(await screen.findByText(/Fatura atual · Nubank/)).toBeInTheDocument()
    expect(screen.getByText(/Limite R\$/)).toBeInTheDocument()
    expect(screen.queryByText(/Itaú/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('group', { name: 'Faturas abertas' })[0].querySelectorAll('.fan-card')).toHaveLength(2)
  })

  it('cartao com limit null (so Inter) nao mostra Limite', async () => {
    withTxs(TXS)
    server.use(
      http.get(`${B}/cards/summary/`, () =>
        HttpResponse.json([
          {
            card_id: 2, name: 'Inter', color: '#FF7A00', bank: 'inter', is_active: true, closing_day: 3, due_day: 10,
            functions: ['credit'], limit: null, committed: '0.00', committed_pct: null, open_cycle_spend: '0.00',
            invoice: { amount: '800.00', snapshot_amount: null, is_paid: true, divergent: true, cycle_start: '2026-10-04', cycle_end: '2026-11-03', due_date: '2026-11-10' },
          },
        ]),
      ),
    )
    setup()
    expect(await screen.findByText(/Fatura atual · Inter/)).toBeInTheDocument()
    expect(screen.queryByText(/Limite/)).not.toBeInTheDocument()
    expect(screen.getByText('fatura divergente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fatura paga/ })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN|null/)
  })

  it('filtra Entradas e busca por descricao', async () => {
    withTxs(TXS)
    setup()
    const ledger = (await screen.findByText('Movimentações')).closest('.ledger') as HTMLElement
    expect(within(ledger).getByText('Mercado Extra')).toBeInTheDocument()
    fireEvent.click(within(ledger).getByRole('button', { name: 'Entradas' }))
    expect(within(ledger).queryByText('Mercado Extra')).not.toBeInTheDocument()
    expect(within(ledger).getByText('Salário')).toBeInTheDocument()
    fireEvent.click(within(ledger).getByRole('button', { name: 'Todas' }))
    fireEvent.change(within(ledger).getByLabelText('Buscar'), { target: { value: 'mercado' } })
    expect(within(ledger).getByText('Mercado Extra')).toBeInTheDocument()
    expect(within(ledger).queryByText('Salário')).not.toBeInTheDocument()
  })

  it('mes vazio oferece Gerar fixos do mes sem erro', async () => {
    withTxs([])
    setup()
    expect(await screen.findByRole('button', { name: 'Gerar fixos do mês' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN|null/)
  })

  it('gerar fixos com variaveis pendentes abre o sheet e confirma', async () => {
    withTxs([])
    const gen = vi.fn()
    server.use(
      http.post(`${B}/months/:y/:m/generate-fixed/`, () =>
        HttpResponse.json({ created: 1, skipped: 0, completed_templates: [], pending_variables: [{ id: 7, description: 'Energia', suggested_amount: '210.00', category_id: null, payment_method_id: null, due_day: 15 }] }),
      ),
      http.post(`${B}/months/:y/:m/generate-variables/`, async ({ request }) => { gen(await request.json()); return HttpResponse.json({ created: 1, skipped: 0 }) }),
    )
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar fixos do mês' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar valores' }))
    await waitFor(() => expect(gen).toHaveBeenCalledWith([{ recurring_id: 7, amount: '210.00' }]))
  })

  it('fixo vencido aparece com etiqueta vencido', async () => {
    withTxs([tx({ id: 9, description: 'Água', amount: '98.00', is_fixed: true, kind: 'fixed', date: '2020-01-05' })])
    setup()
    expect(await screen.findByText('vencido')).toBeInTheDocument()
  })
})
