import { render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MetalCard from './MetalCard'
import { metalRefresh } from './metal'

afterEach(() => { vi.restoreAllMocks() })

const card = { name: 'Meu cartão', bank: 'nubank', due_day: 7 } as const

describe('MetalCard', () => {
  it('renderiza logotipo, nome e vencimento; sem WebGL2 não monta a camada nem lança', () => {
    const err = vi.spyOn(console, 'error')
    const { container, unmount } = render(<MetalCard card={card} />)
    expect(screen.getByText('nu')).toBeInTheDocument()
    expect(screen.getByText('Meu cartão')).toBeInTheDocument()
    expect(screen.getByText('Vence 7')).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
    expect(() => unmount()).not.toThrow()
    expect(() => metalRefresh()).not.toThrow()
    expect(err).not.toHaveBeenCalled()
  })

  it('StrictMode: um único canvas montado, sem console.error', () => {
    const err = vi.spyOn(console, 'error')
    vi.stubGlobal('WebGL2RenderingContext', class {})
    const gl = new Proxy({}, {
      get: (_, k) => (k === 'getActiveUniform' ? () => ({ name: 'u' }) : k === 'getExtension' ? () => null : () => true),
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => gl) as never)
    const { container } = render(<StrictMode><MetalCard card={card} /></StrictMode>)
    expect(container.querySelectorAll('canvas')).toHaveLength(1)
    expect(err).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
