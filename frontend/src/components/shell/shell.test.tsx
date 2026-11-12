import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import AppShell, { useBodyScreen } from './AppShell'
import MonthNav from './MonthNav'

vi.mock('./ProfileCard', () => ({ default: () => null }))
const setPeriod = vi.fn()
vi.mock('@/contexts/PeriodContext', () => ({ usePeriod: () => ({ year: 2026, month: 12, setPeriod }) }))

function Loc() {
  const l = useLocation()
  return <div data-testid="loc">{l.pathname + l.search}</div>
}
function setup(path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route
            path="*"
            element={
              <>
                <Loc />
                <input data-testid="in" />
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell shortcuts', () => {
  it('pressing 2 navigates to /import', () => {
    setup()
    fireEvent.keyDown(window, { key: '2' })
    expect(screen.getByTestId('loc').textContent).toBe('/import')
  })
  it('pressing 2 inside an input does nothing', () => {
    setup()
    fireEvent.keyDown(screen.getByTestId('in'), { key: '2' })
    expect(screen.getByTestId('loc').textContent).toBe('/')
  })
  it('N on / sets ?new=1 and Esc clears it', () => {
    setup()
    fireEvent.keyDown(window, { key: 'n' })
    expect(screen.getByTestId('loc').textContent).toBe('/?new=1')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('loc').textContent).toBe('/')
  })
})

describe('MonthNav', () => {
  it('from Dec 2026 goes to Jan 2027', () => {
    render(<MonthNav />)
    fireEvent.click(screen.getByLabelText('Próximo mês'))
    expect(setPeriod).toHaveBeenCalledWith(2027, 1)
  })
})

describe('useBodyScreen', () => {
  function Probe() {
    useBodyScreen()
    return null
  }
  it('sets login and follows navigation', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Probe />
        <Routes>
          <Route path="*" element={<Loc />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(document.body.dataset.screen).toBe('login')
  })
  it('updates on / -> /login', () => {
    function Go() {
      const nav = useNavigate()
      return <button onClick={() => nav('/login')}>go</button>
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <Probe />
        <Go />
      </MemoryRouter>,
    )
    expect(document.body.dataset.screen).toBe('lanc')
    fireEvent.click(screen.getByText('go'))
    expect(document.body.dataset.screen).toBe('login')
  })
})
