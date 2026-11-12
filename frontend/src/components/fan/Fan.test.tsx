import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Fan from './Fan'
import { sendToBack } from './fanOrder'

const items = ['A', 'B', 'C'].map(t => <span key={t}>{t}</span>)

describe('sendToBack', () => {
  it('move o primeiro para o fim', () => {
    expect(sendToBack([0, 1, 2])).toEqual([1, 2, 0])
  })
})

describe('Fan', () => {
  it('Enter manda o da frente para trás; teclas durante o voo são ignoradas', () => {
    const onChange = vi.fn()
    render(<Fan items={items} onChange={onChange} />)
    const g = screen.getByRole('group')
    expect(g).toHaveClass('fan')
    fireEvent.keyDown(g, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith(1)
    // ArrowLeft durante o voo é ignorado de propósito (guarda C.some(fly))
    fireEvent.keyDown(g, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it('com 1 item, teclas não disparam novos onChange', () => {
    const onChange = vi.fn()
    render(<Fan items={items.slice(0, 1)} onChange={onChange} />)
    onChange.mockClear()
    fireEvent.keyDown(screen.getByRole('group'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reporta 0 na montagem e quando a quantidade de itens muda', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Fan items={items} onChange={onChange} />)
    expect(onChange).toHaveBeenLastCalledWith(0)
    onChange.mockClear()
    rerender(<Fan items={items.slice(0, 2)} onChange={onChange} />)
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('ArrowLeft no início traz o último (2); acessibilidade e size big', () => {
    const onChange = vi.fn()
    render(<Fan items={items} onChange={onChange} size="big" />)
    const g = screen.getByRole('group')
    expect(g).toHaveAttribute('tabindex', '0')
    expect(g).toHaveAttribute('aria-label')
    expect(g).toHaveClass('big')
    fireEvent.keyDown(g, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(2)
  })
})
