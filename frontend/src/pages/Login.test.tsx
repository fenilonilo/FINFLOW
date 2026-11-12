import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '@/contexts/AuthContext'
import Login from './Login'

function setup(login = vi.fn(), user: null | { id: number; email: string; first_name: string; avatar_url: null } = null) {
  render(
    <AuthContext.Provider value={{ user, isLoading: false, login, setUser: vi.fn(), logout: vi.fn() }}>
      <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<p>home</p>} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return login
}

describe('Login', () => {
  it('renderiza textos da moldura e do cartão', () => {
    setup()
    expect(screen.getByText('Bem-vindo de volta')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText('energy.')).toBeInTheDocument()
    expect(screen.getByLabelText('Lembrar este dispositivo')).toBeInTheDocument()
  })

  it('submit chama login(email, senha)', async () => {
    const login = setup(vi.fn().mockResolvedValue(undefined))
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(login).toHaveBeenCalledWith('a@b.com', 'segredo123'))
  })

  it('401 mostra mensagem e mantém o e-mail', async () => {
    setup(vi.fn().mockRejectedValue({ response: { status: 401 } }))
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('E-mail ou senha incorretos')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveValue('a@b.com')
  })

  it('outro erro mostra mensagem genérica', async () => {
    setup(vi.fn().mockRejectedValue(new Error('x')))
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Não foi possível entrar. Tente novamente.')).toBeInTheDocument()
  })

  it('submit vazio mostra erro e não chama login', async () => {
    const login = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Informe o e-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(login).not.toHaveBeenCalled()
  })

  it('botão desabilitado e "Entrando…" durante o envio', async () => {
    setup(vi.fn(() => new Promise<void>(() => {})))
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    const btn = await screen.findByRole('button', { name: 'Entrando…' })
    expect(btn).toBeDisabled()
  })

  it('usuário autenticado é redirecionado para /', () => {
    setup(vi.fn(), { id: 1, email: 'a@b.com', first_name: 'A', avatar_url: null })
    expect(screen.getByText('home')).toBeInTheDocument()
  })
})
