import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PeriodProvider } from '@/contexts/PeriodContext'
import { handlers } from '@/mocks/handlers'
import { api } from '@/api/client'
import Importar from './Importar'

const B = '/api/v1'
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})
afterAll(() => server.close())

const CARD = { id: 1, name: 'Nubank', color: '#820AD1', bank: 'nubank', is_active: true, closing_day: 5, due_day: 12, limit: null, functions: ['credit', 'debit'], active_functions: 'credit,debit' }
const RESULT = {
  created: 1,
  skipped: 3,
  total: '189.90',
  items: [
    { index: 0, date: '2026-11-02', description: 'Mercado Livre', amount: '189.90', category: 'Lazer', category_id: 3, status: 'created' },
    { index: 1, date: '2026-11-03', description: 'Padaria Central', amount: '23.50', category: 'Alimentação', category_id: 2, status: 'duplicate' },
    { index: 2, date: '2026-11-04', description: 'Estorno Loja X', amount: '59.90', category: null, category_id: null, status: 'refunded' },
    { index: 3, date: '2026-11-05', description: 'Pagamento fatura', amount: '1000.00', category: null, category_id: null, status: 'ignored' },
  ],
}

function setup() {
  server.use(http.get(`${B}/cards/`, () => HttpResponse.json({ count: 1, next: null, previous: null, results: [CARD] })))
  const forms: FormData[] = []
  vi.spyOn(api, 'post').mockImplementation(async (_u, data) => {
    forms.push(data as FormData)
    return { data: RESULT }
  })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <PeriodProvider>
        <Importar />
      </PeriodProvider>
    </QueryClientProvider>,
  )
  return forms
}

const drop = async () => {
  const zone = await screen.findByText(/Arraste a fatura do Nubank/)
  const file = new File(['x'], 'fatura.csv', { type: 'text/csv' })
  fireEvent.drop(zone.closest('.drop')!, { dataTransfer: { files: [file] } })
}

describe('Importar', () => {
  it('mostra o histórico de importações', async () => {
    setup()
    expect(await screen.findByText('Nubank · novembro')).toBeInTheDocument()
    expect(screen.getByText('Inter · outubro')).toBeInTheDocument()
    expect(screen.getByText('18 itens · R$ 800,00')).toBeInTheDocument()
  })

  it('soltar o arquivo envia prévia com card_id, kind e dry_run=true', async () => {
    const forms = setup()
    await drop()
    await waitFor(() => expect(forms).toHaveLength(1))
    expect(forms[0].get('card_id')).toBe('1')
    expect(forms[0].get('kind')).toBe('credit')
    expect(forms[0].get('dry_run')).toBe('true')
  })

  it('conferência mostra os 4 status e duplicado tem classe dup', async () => {
    setup()
    await drop()
    expect(await screen.findByText('Mercado Livre')).toBeInTheDocument()
    expect(screen.getByText('Padaria Central').closest('tr')).toHaveClass('dup')
    expect(screen.getByText('Estorno Loja X').closest('tr')).toHaveClass('refunded')
    expect(screen.getByText('Pagamento fatura').closest('tr')).toHaveClass('ignored')
    expect(screen.getByRole('button', { name: 'Importar 1 lançamentos' })).toBeInTheDocument()
  })

  it('trocar categoria e importar envia dry_run=false com categories', async () => {
    const forms = setup()
    await drop()
    fireEvent.click(await screen.findByRole('button', { name: /Lazer/ }))
    const sel = await screen.findByRole('combobox', { name: 'Categoria' })
    await waitFor(() => expect(within(sel).getAllByRole('option').length).toBeGreaterThan(1))
    const opt = within(sel).getAllByRole('option').find((o) => (o as HTMLOptionElement).value !== '3' && (o as HTMLOptionElement).value !== '')!
    fireEvent.change(sel, { target: { value: (opt as HTMLOptionElement).value } })
    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 lançamentos' }))
    await waitFor(() => expect(forms).toHaveLength(2))
    expect(forms[1].get('dry_run')).toBe('false')
    expect(JSON.parse(forms[1].get('categories') as string)).toEqual({ 0: Number((opt as HTMLOptionElement).value) })
    await waitFor(() => expect(screen.getByText(/A conferência aparece aqui/)).toBeInTheDocument())
  })
})
