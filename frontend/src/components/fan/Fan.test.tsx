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
  it('Enter manda o da frente para trás; ArrowLeft traz o último de volta', () => {
    const onChange = vi.fn()
    render(<Fan items={items} onChange={onChange} />)
    const g = screen.getByRole('group')
    expect(g).toHaveClass('fan')
    fireEvent.keyDown(g, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(g, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('com 1 item, teclas não chamam onChange', () => {
    const onChange = vi.fn()
    render(<Fan items={items.slice(0, 1)} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('group'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
