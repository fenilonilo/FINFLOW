import { useEffect, useRef } from 'react'
import { createBull } from './bull'

const IGNORE = 'button, input, a, .glass, .fan, .flip, nav, [role=dialog]'

export default function BullBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const bull = createBull(canvas)
    if (!bull) {
      canvas.dataset.fallback = 'true'
      return
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => sync()) : null
    let observed: Element | null = null
    function sync() {
      const main = document.querySelector('main')
      if (main !== observed) {
        if (observed) ro?.unobserve(observed)
        if (main) ro?.observe(main)
        observed = main
      }
      const content = main?.firstElementChild ?? main
      bull!.place(document.body.dataset.screen ?? 'login', content ? content.getBoundingClientRect() : null)
    }
    sync()
    const mo = new MutationObserver(sync)
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-screen'] })
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(IGNORE)) return
      bull.shock(e.clientX, e.clientY)
    }
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      mo.disconnect()
      ro?.disconnect()
      bull.dispose()
    }
  }, [])

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 block h-full w-full" />
}
