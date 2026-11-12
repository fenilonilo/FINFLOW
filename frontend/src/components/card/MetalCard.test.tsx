import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MetalCard from './MetalCard'
import { metalRefresh } from './metal'

describe('MetalCard', () => {
  it('renderiza nome, marca e vencimento; sem WebGL2 não monta a camada nem lança', () => {
    const err = vi.spyOn(console, 'error')
    const { container, unmount } = render(<MetalCard card={{ name: 'Nubank', bank: 'nubank', due_day: 7 }} />)
    expect(screen.getAllByText('Nubank').length).toBeGreaterThan(0)
    expect(screen.getByText('Vence 7')).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
    expect(() => unmount()).not.toThrow()
    expect(() => metalRefresh()).not.toThrow()
    expect(err).not.toHaveBeenCalled()
  })
})
