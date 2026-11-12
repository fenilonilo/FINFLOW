import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { handlers } from '@/mocks/handlers'
import { AuthContext } from '@/contexts/AuthContext'
import Conta, { daysAgo } from './Conta'

const B = '/api/v1'
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const user = { id: 1, email: 'felipe@finflow.app', first_name: 'Felipe', avatar_url: null }

function setup(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={{ user, isLoading: false, login: vi.fn(), setUser: vi.fn(), logout: vi.fn() }}>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes><Route path="/account/:tab" element={<Conta />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('Conta', () => {
  it('daysAgo conta por data de calendário', () => {
    const now = new Date(2026, 10, 12, 8, 0)
    expect(daysAgo(new Date(2026, 10, 11, 23, 59).toISOString(), now)).toBe(1)
    expect(daysAgo(new Date(2026, 10, 12, 0, 1).toISOString(), now)).toBe(0)
    expect(daysAgo(new Date(2026, 10, 10, 9, 0).toISOString(), now)).toBe(2)
  })

  it('dispositivos: Ativo na sessão atual, sem Encerrar nela', async () => {
    setup('/account/devices')
    expect(await screen.findByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('este dispositivo · ativo agora')).toBeInTheDocument()
    expect(screen.getByText('último acesso há 1 dia')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Encerrar' })).toHaveLength(1)
  })

  it('Encerrar faz DELETE da sessão', async () => {
    const del = vi.fn()
    server.use(http.delete(`${B}/auth/sessions/:id/`, ({ params }) => { del(params.id); return new HttpResponse(null, { status: 204 }) }))
    setup('/account/devices')
    fireEvent.click(await screen.findByRole('button', { name: 'Encerrar' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('2'))
  })

  it('lista vazia', async () => {
    server.use(http.get(`${B}/auth/sessions/`, () => HttpResponse.json([])))
    setup('/account/devices')
    expect(await screen.findByText('Nenhuma sessão registrada')).toBeInTheDocument()
  })

  it('perfil: editar nome e Salvar faz PATCH', async () => {
    const patch = vi.fn()
    server.use(http.patch(`${B}/auth/me/`, async ({ request }) => { patch(await request.json()); return HttpResponse.json(user) }))
    setup('/account/profile')
    const nome = screen.getByLabelText('Nome')
    fireEvent.change(nome, { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith({ first_name: 'Ana', email: 'felipe@finflow.app' }))
  })

  it('erro do envelope aparece no campo e-mail', async () => {
    server.use(http.patch(`${B}/auth/me/`, () => HttpResponse.json({ detail: 'x', errors: { email: ['E-mail já em uso'] } }, { status: 400 })))
    setup('/account/profile')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('E-mail já em uso')).toBeInTheDocument()
  })

  it('arquivo > 2 MB não é enviado e mostra erro', async () => {
    const post = vi.fn()
    server.use(http.post(`${B}/auth/me/avatar/`, () => { post(); return HttpResponse.json(user) }))
    const { container } = setup('/account/profile')
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' })
    await userEvent.upload(container.querySelector('input[type=file]')!, big)
    expect(await screen.findByText('A foto deve ter até 2 MB')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })
})
