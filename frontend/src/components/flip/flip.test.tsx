import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/AuthContext'
import { PeriodProvider } from '@/contexts/PeriodContext'
import FlipCard from './FlipCard'
import { releaseTarget } from './flipMath'
import ProfileCard from '@/components/shell/ProfileCard'

afterEach(() => { vi.useRealTimers() })

describe('releaseTarget', () => {
  it('encaixa no lado mais próximo e respeita a velocidade', () => {
    expect(releaseTarget(100, 0)).toBe(180)
    expect(releaseTarget(80, 0)).toBe(0)
    expect(releaseTarget(10, 2000)).toBe(180)
  })
})

describe('FlipCard', () => {
  it('Enter vira; face oculta fica inert', () => {
    render(<FlipCard front={<button>frente</button>} back={<button>verso</button>} />)
    const root = screen.getByRole('button', { pressed: false })
    const [front, back] = Array.from(root.querySelectorAll('.flip-face'))
    expect(back).toHaveAttribute('inert')
    expect(front).not.toHaveAttribute('inert')
    fireEvent.keyDown(root, { key: 'Enter' })
    expect(root).toHaveAttribute('aria-pressed', 'true')
    expect(front).toHaveAttribute('inert')
    expect(back).not.toHaveAttribute('inert')
  })
})

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderProfile(path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const logout = vi.fn(async () => {})
  render(
    <AuthContext.Provider
      value={{ user: { id: 1, email: 'a@b.c', first_name: 'Ana', avatar_url: null }, isLoading: false, login: async () => {}, logout, setUser: () => {} }}
    >
      <QueryClientProvider client={qc}>
        <PeriodProvider>
          <MemoryRouter initialEntries={[path]}>
            <ProfileCard />
            <Where />
          </MemoryRouter>
        </PeriodProvider>
      </QueryClientProvider>
    </AuthContext.Provider>,
  )
  return { logout }
}

describe('ProfileCard', () => {
  it('mostra o nome e navega para Dispositivos, virando de volta depois de 300 ms', () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    renderProfile()
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0)
    const root = screen.getByLabelText('Conta: clique para virar')
    fireEvent.keyDown(root, { key: 'Enter' })
    fireEvent.click(screen.getByText('Dispositivos'))
    expect(screen.getByTestId('where')).toHaveTextContent('/account/devices')
    expect(root).toHaveAttribute('aria-pressed', 'true')
    act(() => { vi.advanceTimersByTime(300) })
    expect(root).toHaveAttribute('aria-pressed', 'false')
  })

  it('Sair chama logout; borda verde em /account', () => {
    const { logout } = renderProfile('/account/profile')
    expect(screen.getByLabelText('Conta: clique para virar')).toHaveClass('on-account')
    fireEvent.click(screen.getByText('Sair'))
    expect(logout).toHaveBeenCalled()
  })
})
