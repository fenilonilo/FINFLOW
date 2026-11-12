import { useEffect, useRef } from 'react'
import { BANKS } from '@/lib/banks'
import type { BankKey } from '@/types/models'
import { mountMetal } from './metal'

export type MetalCardData = { name: string; bank: BankKey; due_day: number }

// Tamanhos em cqw: base do protótipo = 340px de largura.
const cq = (px: number) => `${((px / 340) * 100).toFixed(2)}cqw`

export default function MetalCard({ card }: { card: MetalCardData }) {
  const host = useRef<HTMLDivElement>(null)
  const plate = useRef<HTMLDivElement>(null)
  const b = BANKS[card.bank]

  useEffect(() => {
    if (!host.current || !plate.current) return
    // canvas novo a cada mount (StrictMode: mount→cleanup→mount não reaproveita contexto perdido)
    const c = document.createElement('canvas')
    c.setAttribute('aria-hidden', 'true')
    c.className = 'pointer-events-none absolute inset-0 h-full w-full'
    c.style.mixBlendMode = 'screen'
    plate.current.insertBefore(c, plate.current.firstChild)
    const dispose = mountMetal(host.current, plate.current, c)
    if (!dispose) c.remove() // sem WebGL2: camada não montada
    return () => {
      dispose?.()
      c.remove()
    }
  }, [])

  return (
    <div ref={host} className="w-full" style={{ aspectRatio: '340 / 214', perspective: 900, containerType: 'inline-size' }}>
      <div
        ref={plate}
        className="relative h-full w-full overflow-hidden"
        style={{
          background: b.gradient || b.accent,
          color: b.ink,
          borderRadius: cq(18),
          isolation: 'isolate',
          transform: 'rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))',
          willChange: 'transform',
          boxShadow: '0 26px 50px -18px rgba(0,0,0,.75), 0 8px 18px -8px rgba(0,0,0,.5)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            mixBlendMode: 'overlay',
            background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 1px, rgba(0,0,0,.05) 1px 2px)',
          }}
        />
        <div className="relative z-[1] flex h-full flex-col justify-between" style={{ padding: `${cq(20)} ${cq(22)}` }}>
          <div className="flex items-start justify-between">
            <span
              style={{
                fontSize: cq(24), lineHeight: 1, fontWeight: 700, fontFamily: 'Manrope, system-ui, sans-serif',
                ...b.wmStyle, ...(b.wmStyle?.fontSize && { fontSize: cq(parseFloat(b.wmStyle.fontSize)) }),
              }}
            >
              {b.wm ?? b.label}
            </span>
            <svg style={{ width: cq(22), height: cq(22), opacity: 0.85 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M7 8a6 6 0 0 1 0 8M11 5.5a10 10 0 0 1 0 13M15 3a14 14 0 0 1 0 18" />
            </svg>
          </div>
          <svg style={{ width: cq(44) }} viewBox="0 0 40 30" aria-hidden>
            <rect width="40" height="30" rx="5" fill="#d9b45a" />
            <g stroke="#8a6a1f" strokeWidth="1" fill="none">
              <path d="M0 10h13v10H0M27 10h13M27 20h13M13 0v30M27 0v30M13 15h14" />
              <rect x="13" y="10" width="14" height="10" rx="2" />
            </g>
          </svg>
          <div className="flex items-end justify-between uppercase" style={{ fontSize: cq(11), letterSpacing: '.08em' }}>
            <b style={{ fontSize: cq(13), letterSpacing: '.06em', fontWeight: 600 }}>{card.name}</b>
            <span>Vence {card.due_day}</span>
          </div>
        </div>
        <span
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{ borderRadius: 'inherit', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.2), inset 0 1px 0 rgba(255,255,255,.35)' }}
        />
      </div>
    </div>
  )
}
