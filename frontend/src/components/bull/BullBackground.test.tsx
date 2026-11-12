import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BullBackground from './BullBackground'
import { createBull } from './bull'

vi.mock('./bull', () => ({ createBull: vi.fn() }))

afterEach(() => {
  document.querySelector('main')?.remove()
  vi.mocked(createBull).mockReset()
})

describe('BullBackground', () => {
  it('sem WebGL renderiza sem lançar e marca data-fallback', () => {
    vi.mocked(createBull).mockReturnValue(null)
    const { container, unmount } = render(<BullBackground />)
    expect(container.querySelector('canvas')?.getAttribute('data-fallback')).toBe('true')
    expect(() => unmount()).not.toThrow()
  })

  it('re-sincroniza com rect não-nulo quando o <main> aparece depois', async () => {
    const place = vi.fn()
    vi.mocked(createBull).mockReturnValue({ place, shock: vi.fn(), dispose: vi.fn() })
    render(<BullBackground />)
    expect(place).toHaveBeenLastCalledWith(expect.any(String), null)
    document.body.appendChild(document.createElement('main'))
    await vi.waitFor(() => expect(place).toHaveBeenLastCalledWith(expect.any(String), expect.anything()))
  })
})
