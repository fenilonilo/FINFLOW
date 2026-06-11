import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import KpiCard from './KpiCard'

describe('KpiCard', () => {
  it('renders title and value', () => {
    render(<KpiCard title="Entradas" value="R$ 8.000,00" />)
    expect(screen.getByText('Entradas')).toBeTruthy()
    expect(screen.getByText('R$ 8.000,00')).toBeTruthy()
  })

  it('renders subtitle when provided', () => {
    render(<KpiCard title="Saldo" value="R$ 500,00" subtitle="vs mês anterior" />)
    expect(screen.getByText('vs mês anterior')).toBeTruthy()
  })

  it('applies positive variant class', () => {
    const { container } = render(<KpiCard title="Test" value="R$ 100,00" variant="positive" />)
    const valueEl = container.querySelector('.text-accent')
    expect(valueEl).toBeTruthy()
  })

  it('applies negative variant class', () => {
    const { container } = render(<KpiCard title="Test" value="R$ 100,00" variant="negative" />)
    const valueEl = container.querySelector('.text-danger')
    expect(valueEl).toBeTruthy()
  })
})
