import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BullBackground from './BullBackground'

describe('BullBackground', () => {
  it('sem WebGL renderiza sem lançar e marca data-fallback', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { container, unmount } = render(<BullBackground />)
    expect(container.querySelector('canvas')?.getAttribute('data-fallback')).toBe('true')
    expect(() => unmount()).not.toThrow()
  })
})
