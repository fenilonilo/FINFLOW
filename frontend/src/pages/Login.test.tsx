import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '@/contexts/AuthContext'
import Login from './Login'

function setup(login = vi.fn()) {
  render(
    <AuthContext.Provider value={{ user: null, isLoading: false, login, setUser: vi.fn(), logout: vi.fn() }}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Login />
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
})
