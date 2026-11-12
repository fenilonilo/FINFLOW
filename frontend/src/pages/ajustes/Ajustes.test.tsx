import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { handlers } from '@/mocks/handlers'
import { PeriodProvider } from '@/contexts/PeriodContext'
import Ajustes from './Ajustes'

const B = '/api/v1'
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const page = (results: unknown[]) => HttpResponse.json({ count: results.length, next: null, previous: null, results })
const cat = (id: number) => ({ id, name: `Cat ${id}`, icon: 'tag', color: '#34d399', parent: null, monthly_budget: null, is_default: false, is_archived: false, transaction_count: 0 })
const withCats = (n: number) => server.use(http.get(`${B}/categories/`, () => page(Array.from({ length: n }, (_, i) => cat(i + 1)))))

function setup(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PeriodProvider>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes><Route path="/settings/:tab" element={<Ajustes />} /></Routes>
        </MemoryRouter>
      </PeriodProvider>
    </QueryClientProvider>,
  )
}

describe('Ajustes', () => {
  it('7 categorias -> 3 colunas', async () => {
    withCats(7)
    const { container } = setup('/settings/categories')
    await screen.findByText('Cat 7')
    expect(container.querySelector('.cats')).toHaveAttribute('data-cols', '3')
  })

  it('8 categorias -> 4 colunas', async () => {
    withCats(8)
    const { container } = setup('/settings/categories')
    await screen.findByText('Cat 8')
    expect(container.querySelector('.cats')).toHaveAttribute('data-cols', '4')
  })

  it('/settings/cards abre a aba Cartões', async () => {
    setup('/settings/cards')
    expect(await screen.findByText('Fechamento')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Cartões' })).toHaveAttribute('aria-selected', 'true')
  })

  it('criar categoria pelo sheet faz POST', async () => {
    withCats(1)
    const post = vi.fn()
    server.use(http.post(`${B}/categories/`, async ({ request }) => { post(await request.json()); return HttpResponse.json({ id: 50 }, { status: 201 }) }))
    setup('/settings/categories')
    fireEvent.click(await screen.findByRole('button', { name: '+ Nova categoria' }))
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Pets' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pets' })))
  })

  it('Desativar cartão faz PATCH is_active false', async () => {
    const patch = vi.fn()
    server.use(http.patch(`${B}/cards/:id/`, async ({ request }) => { patch(await request.json()); return HttpResponse.json({}) }))
    setup('/settings/cards')
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith({ is_active: false }))
  })

  it('Pausar fixo faz PATCH status paused', async () => {
    const patch = vi.fn()
    server.use(
      http.get(`${B}/recurring-expenses/`, () => page([{
        id: 7, type: 'expense', card: null, start_date: null, description: 'Aluguel', is_variable: false, category: 1,
        category_detail: { id: 1, name: 'Moradia', icon: 'home', color: '#fff' }, payment_method: 1,
        payment_method_detail: { id: 1, name: 'Pix', icon: 'zap', color: '#fff' }, default_amount: '1800.00', due_day: 5,
        status: 'active', total_occurrences: null, generated_count: 0, acquisition: null,
      }])),
      http.patch(`${B}/recurring-expenses/:id/`, async ({ request }) => { patch(await request.json()); return HttpResponse.json({}) }),
    )
    setup('/settings/fixed')
    expect(await screen.findByText('Moradia · Pix')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith({ status: 'paused' }))
  })

  it('Total previsto exclui receitas', async () => {
    const r = (id: number, type: string, amt: string) => ({
      id, type, card: null, start_date: null, description: `T${id}`, is_variable: false, category: null, category_detail: null,
      payment_method: null, payment_method_detail: null, default_amount: amt, due_day: id, status: 'active', total_occurrences: null, generated_count: 0, acquisition: null,
    })
    server.use(http.get(`${B}/recurring-expenses/`, () => page([r(1, 'expense', '100.00'), r(2, 'income', '8000.00')])))
    setup('/settings/fixed')
    const row = (await screen.findByText('Total previsto')).closest('.rw')!
    expect(row.textContent).toMatch(/100,00/)
    expect(row.textContent).not.toMatch(/8\.100/)
  })
})
