import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import type { BankKey } from '@/types/models'
import { BANKS, BANK_STRIPE } from '@/lib/banks'

interface Props {
  bank: BankKey
  name: string
  /** cor do cartão — usada só quando bank === 'other' */
  color?: string
  functions?: Array<'credit' | 'debit'>
  dueDay?: number
  inactive?: boolean
  /** desliga tilt/glare (miniaturas) */
  static?: boolean
  /** tilt 3D (glare segue o ponteiro mesmo sem tilt) */
  tilt?: boolean
  className?: string
}

const MAX_TILT = 12
const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const WORDMARK: Partial<Record<BankKey, CSSProperties>> = {
  nubank: { textTransform: 'lowercase', fontWeight: 800, letterSpacing: '-0.04em' },
  inter: { textTransform: 'lowercase', fontWeight: 700 },
  itau: { fontWeight: 900, fontStyle: 'italic' },
  bb: { fontWeight: 900, letterSpacing: '-0.02em' },
  xp: { fontWeight: 900, letterSpacing: '0.15em' },
  c6: { fontWeight: 800 },
  neon: { textTransform: 'lowercase', fontWeight: 800 },
}

export default function BankCard({
  bank,
  name,
  color,
  functions = [],
  dueDay,
  inactive,
  static: isStatic,
  tilt = true,
  className = '',
}: Props) {
  const b = BANKS[bank] ?? BANKS.other
  const bg = bank === 'other' || !b.gradient ? (color ?? b.accent) : b.gradient
  const stripe = BANK_STRIPE[bank] ?? b.ink
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const interactive = !isStatic && !inactive

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || !interactive || reduced()) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    if (tilt) {
      el.style.transition = 'transform 120ms ease-out'
      el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 2 * MAX_TILT}deg) rotateY(${(x - 0.5) * 2 * MAX_TILT}deg)`
    }
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
    el.style.setProperty('--glare', '1')
  }
  const onLeave = () => {
    const el = ref.current
    if (!el) return
    if (tilt) {
      el.style.transition = 'transform 600ms cubic-bezier(.2,1.4,.4,1)'
      el.style.transform = 'perspective(900px) rotateX(0) rotateY(0)'
    }
    el.style.setProperty('--glare', '0')
  }

  const fn = functions.map((f) => (f === 'credit' ? 'Crédito' : 'Débito')).join(' · ')

  return (
    <div
      className={`w-full select-none ${className}`}
      style={{
        containerType: 'inline-size',
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(12px)',
        transition: reduced() ? 'none' : 'opacity 500ms ease, transform 500ms ease',
      }}
    >
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="relative overflow-hidden"
        style={{
          aspectRatio: '1.586 / 1',
          borderRadius: '5cqw',
          background: bg,
          color: b.ink,
          boxShadow:
            'inset 0 0 0 1px rgba(255,255,255,.22), inset 0 1px 0 rgba(255,255,255,.35), 0 24px 40px -12px rgba(0,0,0,.6), 0 8px 16px -8px rgba(0,0,0,.5)',
          filter: inactive ? 'grayscale(1)' : undefined,
          opacity: inactive ? 0.55 : 1,
          transform: 'perspective(900px)',
          willChange: 'transform',
          '--mx': '50%',
          '--my': '30%',
          '--glare': '0',
        } as CSSProperties}
      >
        {/* brushed metal */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, rgba(0,0,0,.04) 1px 2px)',
            mixBlendMode: 'overlay',
          }}
        />
        {/* sheen diagonal */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(115deg, transparent 30%, rgba(255,255,255,.14) 45%, transparent 60%)',
          }}
        />
        {/* glare seguindo o ponteiro */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,.55), transparent 55%)',
            mixBlendMode: 'soft-light',
            opacity: 'var(--glare)' as unknown as number,
            transition: 'opacity 300ms',
          }}
        />
        {/* faixa de marca */}
        {BANK_STRIPE[bank] && bank !== 'itau' && (
          <div
            className="absolute left-0 right-0"
            style={{ bottom: '27%', height: '1.2cqw', background: stripe, opacity: 0.9 }}
          />
        )}

        <div className="relative flex h-full flex-col justify-between" style={{ padding: '6cqw' }}>
          <div className="flex items-start justify-between gap-2">
            <span
              className="truncate"
              style={{ fontSize: '7.5cqw', lineHeight: 1, fontWeight: 700, ...WORDMARK[bank] }}
            >
              {b.label}
            </span>
            {/* contactless */}
            <svg viewBox="0 0 24 24" style={{ width: '7cqw', height: '7cqw' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M7 8a6 6 0 0 1 0 8M11 5.5a10 10 0 0 1 0 13M15 3a14 14 0 0 1 0 18" />
            </svg>
          </div>

          {/* chip EMV */}
          <svg viewBox="0 0 40 30" style={{ width: '13cqw' }} aria-hidden>
            <rect width="40" height="30" rx="5" fill="#d9b45a" />
            <g stroke="#8a6a1f" strokeWidth="1" fill="none">
              <path d="M0 10h13v10H0M27 10h13M27 20h13M13 0v30M27 0v30M13 15h14" />
              <rect x="13" y="10" width="14" height="10" rx="2" />
            </g>
          </svg>

          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate" style={{ fontSize: '5cqw', fontWeight: 600, letterSpacing: '0.04em' }}>
                {name || 'Nome do cartão'}
              </p>
              <p style={{ fontSize: '3.8cqw', opacity: 0.85, letterSpacing: '0.12em' }}>
                •••• {fn}
              </p>
            </div>
            {dueDay != null && (
              <span style={{ fontSize: '3.6cqw', opacity: 0.85, whiteSpace: 'nowrap' }}>Vence {dueDay}</span>
            )}
          </div>
        </div>

        {inactive && (
          <span
            className="absolute right-3 top-3 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
          >
            Desativado
          </span>
        )}
      </div>
    </div>
  )
}
