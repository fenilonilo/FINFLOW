import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { spring, stepSprings, type Spring } from '../../lib/spring'
import { bringToFront, sendToBack } from './fanOrder'

type Props = {
  items: ReactNode[]
  onChange: (topIndex: number) => void
  size?: 'sm' | 'big'
  visible?: number
  spread?: number
  depth?: number
  tilt?: number
  threshold?: number
  label?: string
}

const SPR = { place: [260, 24], settle: [320, 34], tuck: [240, 28], face: [240, 30], lean: [240, 28], press: [420, 34], fling: [650, 42] } as const
type Kind = keyof typeof SPR
const KEYS = ['x', 'y', 'rot', 'sc', 'tx', 'ty', 'spin', 'lift'] as const
const INIT = { x: 0, y: 0, rot: 0, sc: 1, tx: 0, ty: 0, spin: 0, lift: 1 }
const EPS = { p: 1e-3, v: 1e-2 }
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t

type Fly = { turned: boolean; landed: boolean; out: [number, number]; dx: number; dy: number; span: number; t0: number }
type Sample = [number, number, number]
type Api = { toBack: () => void; toFront: () => void }
const NOOP: Api = { toBack: () => {}, toFront: () => {} }

const speed = (smp: Sample[], t: number): [number, number] => {
  const r = smp.filter(s => t - s[2] <= 100)
  if (r.length < 2) return [0, 0]
  const a = r[0], b = r[r.length - 1], e = Math.max((b[2] - a[2]) / 1000, 0.008)
  return [(b[0] - a[0]) / e, (b[1] - a[1]) / e]
}

export default function Fan({ items, onChange, size = 'sm', visible = 4, spread = 0.5, depth = 0.5, tilt = 30, threshold = 90, label = 'Cartões' }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLDivElement | null)[]>([])
  const api = useRef<Api>(NOOP)
  const cb = useRef(onChange)
  cb.current = onChange
  const n = items.length

  useEffect(() => {
    const el = root.current
    if (!el || n === 0) return
    cb.current(0)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const vis = Math.min(visible, n)
    let order = Array.from({ length: n }, (_, i) => i)
    let drag: { i: number; sx: number; sy: number; ox: number; oy: number; vx: number; vy: number; moved: boolean; prog: number; smp: Sample[]; idle?: ReturnType<typeof setTimeout> } | null = null
    let raf = 0, last = 0, dead = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const place = (k: number) => ({ x: 0, y: 0, rot: k * spread * 8, sc: 1 - k * depth * 0.12 })

    const C = order.map(i => {
      const card = cards.current[i]!
      const face = card.firstElementChild as HTMLElement
      const shade = face.lastElementChild as HTMLElement
      const s = {} as Record<(typeof KEYS)[number], Spring>
      for (const k of KEYS) s[k] = spring(INIT[k], 260, 24)
      return { card, face, shade, s, fly: null as Fly | null }
    })

    const wake = () => { if (!raf && !dead) raf = requestAnimationFrame(loop) }
    const to = (sp: Spring, t: number, kind: Kind, v?: number) => {
      sp.t = t; [sp.k, sp.c] = SPR[kind]
      if (v !== undefined) sp.v = v
      if (reduced) { sp.p = t; sp.v = 0 }
      wake()
    }
    function flight(c: (typeof C)[number]) {
      const f = c.fly!, i = C.indexOf(c), outward = c.s.x.v * f.dx + c.s.y.v * f.dy, late = performance.now() - f.t0 > 1500
      if (!f.turned && (Math.hypot(f.out[0] - c.s.x.p, f.out[1] - c.s.y.p) <= f.span * 0.06 || outward < 0 || late)) {
        f.turned = true; put(i, order.indexOf(i), { kind: 'tuck', keepZ: true })
      }
      if (!f.landed) {
        const m = c.card.getBoundingClientRect(), b = C[order[0]].card.getBoundingClientRect()
        const clear = m.right < b.left || m.left > b.right || m.bottom < b.top || m.top > b.bottom
        if (clear || (f.turned && outward < 0) || late) { f.landed = true; c.card.style.zIndex = String(n - order.indexOf(i)) }
      }
      if (f.turned && f.landed) c.fly = null
      return true
    }
    function loop(now: number) {
      raf = 0
      const dt = last ? (now - last) / 1000 : 1 / 60
      last = now
      let busy = false
      for (const c of C) {
        if (stepSprings(Object.values(c.s), dt, EPS)) busy = true
        const s = c.s
        c.card.style.transform = `translate(${s.x.p}px,${s.y.p}px) rotate(${s.rot.p}deg) scale(${s.sc.p})`
        c.face.style.transform = `perspective(800px) rotateX(${s.tx.p}deg) rotateY(${s.ty.p}deg) rotate(${s.spin.p}deg) scale(${s.lift.p})`
        if (c.fly) busy = flight(c) || busy
      }
      if (busy) wake(); else last = 0
    }
    const face0 = (c: (typeof C)[number], kind: Kind = 'face') => {
      to(c.s.tx, 0, kind); to(c.s.ty, 0, kind); to(c.s.spin, 0, kind); to(c.s.lift, 1, kind)
    }
    function put(i: number, k: number, o: { lift?: number; kind?: Kind; v?: number[] | null; keepZ?: boolean } = {}) {
      const { lift = 0, kind = 'place', v = null, keepZ = false } = o
      const c = C[i], shown = Math.min(k, vis - 1), t = place(shown)
      if (lift && shown) { const a = place(shown - 1); for (const p of ['x', 'y', 'rot', 'sc'] as const) t[p] = mix(t[p], a[p], lift) }
      if (!keepZ) c.card.style.zIndex = String(n - k)
      to(c.s.x, t.x, kind, v?.[0]); to(c.s.y, t.y, kind, v?.[1]); to(c.s.rot, t.rot, kind); to(c.s.sc, t.sc, kind); face0(c)
      c.card.style.opacity = k < vis ? '1' : '0'
      c.shade.style.opacity = String(Math.min(0.6, shown * depth * 0.14 * (1 - lift)))
      c.card.toggleAttribute('data-top', k === 0)
      c.card.setAttribute('aria-hidden', k ? 'true' : 'false')
    }
    const putAll = (o: { lift?: number; kind?: Kind; released?: number; v?: number[] } = {}) => order.forEach((i, k) => {
      if (C[i].fly && !C[i].fly!.turned) return
      if (drag?.moved && drag.i === i) return
      put(i, k, { lift: k ? o.lift || 0 : 0, kind: C[i].fly ? 'tuck' : i === o.released ? 'settle' : o.kind || 'place', v: i === o.released ? o.v : null, keepZ: !!C[i].fly })
    })
    const commit = (next: number[]) => { order = next; cb.current(order[0]) }

    function toBack(dir?: [number, number], vel?: [number, number]) {
      if (n < 2 || C[order[0]].fly) return
      const top = order[0], c = C[top]
      if (reduced) { commit(sendToBack(order)); putAll(); return }
      let [dx, dy] = dir ?? [1, -0.3]
      const len = Math.hypot(dx, dy) || 1
      dx /= len; dy /= len
      const r = el!.getBoundingClientRect(), clr = Math.min(r.width / Math.max(Math.abs(dx), 0.01), r.height / Math.max(Math.abs(dy), 0.01))
      const out: [number, number] = [dx * (clr * 1.12 + 40), dy * (clr * 1.12 + 40)]
      c.fly = { turned: false, landed: false, out, dx, dy, span: Math.max(Math.hypot(out[0] - c.s.x.p, out[1] - c.s.y.p), 1), t0: performance.now() }
      c.card.style.zIndex = String(n + 1)
      to(c.s.x, out[0], 'fling', vel?.[0]); to(c.s.y, out[1], 'fling', vel?.[1]); face0(c)
      commit(sendToBack(order)); putAll()
    }
    function toFront() {
      if (n < 2 || C[order[0]].fly) return
      C[order[n - 1]].fly = null // se ainda estiver em voo, volta direto para a frente
      commit(bringToFront(order)); putAll({ kind: 'settle' })
    }
    api.current = { toBack: () => toBack(), toFront }

    function lean(d: NonNullable<typeof drag>) {
      const s = C[d.i].s, ox = s.x.p, oy = s.y.p
      to(s.ty, (clamp(d.vx / 1300, -1, 1) * 0.7 + clamp(ox / 260, -1, 1) * 0.3) * tilt, 'lean')
      to(s.tx, (clamp(-d.vy / 1300, -1, 1) * 0.7 + clamp(-oy / 260, -1, 1) * 0.3) * tilt, 'lean')
      to(s.spin, clamp(ox / 260, -1, 1) * 6, 'lean')
    }
    const down = (e: PointerEvent, i: number) => {
      if (e.button !== 0 || drag || order[0] !== i || C[i].fly) return
      const c = C[i], b = c.card.getBoundingClientRect()
      c.card.setPointerCapture?.(e.pointerId)
      c.face.style.transformOrigin = `${clamp((e.clientX - b.left) / b.width, 0, 1) * 100}% ${clamp((e.clientY - b.top) / b.height, 0, 1) * 100}%`
      to(c.s.lift, 1.035, 'press')
      drag = { i, sx: e.clientX, sy: e.clientY, ox: 0, oy: 0, vx: 0, vy: 0, moved: false, prog: 0, smp: [[e.clientX, e.clientY, e.timeStamp]] }
      if (e.pointerType === 'mouse') e.preventDefault()
    }
    const move = (e: PointerEvent) => {
      const d = drag
      if (!d) return
      const s = C[d.i].s, dx = e.clientX - d.sx, dy = e.clientY - d.sy
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 6) return
        d.moved = true; d.ox = s.x.p - dx; d.oy = s.y.p - dy; el.classList.add('drag')
      }
      for (const [sp, v] of [[s.x, d.ox + dx], [s.y, d.oy + dy]] as const) { sp.p = sp.t = v; sp.v = 0 }
      d.smp.push([e.clientX, e.clientY, e.timeStamp])
      if (d.smp.length > 12) d.smp.shift()
      ;[d.vx, d.vy] = speed(d.smp, e.timeStamp)
      lean(d); wake()
      clearTimeout(d.idle)
      d.idle = setTimeout(() => { if (drag === d) { d.vx = d.vy = 0; lean(d) } }, 70)
      const p = clamp(Math.hypot(dx, dy) / threshold, 0, 1)
      if (Math.abs(p - d.prog) > 0.02) { d.prog = p; putAll({ lift: p * 0.4, kind: 'settle' }) }
    }
    const up = (e: PointerEvent) => {
      const d = drag
      if (!d) return
      drag = null; clearTimeout(d.idle); el.classList.remove('drag')
      if (!d.moved) { face0(C[d.i]); return }
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy, [vx, vy] = speed(d.smp, e.timeStamp), dist = Math.hypot(dx, dy), pace = Math.hypot(vx, vy)
      const flick = pace > 650 && dist > 16 && vx * dx + vy * dy > 0
      if (e.type === 'pointerup' && (dist > threshold || flick)) toBack(pace > 300 ? [vx, vy] : [dx, dy], [vx, vy])
      else putAll({ released: d.i, v: [clamp(vx, -3000, 3000), clamp(vy, -3000, 3000)] })
    }
    const offs = C.map((c, i) => {
      const dn = (e: PointerEvent) => down(e, i)
      c.card.addEventListener('pointerdown', dn)
      c.card.addEventListener('pointermove', move); c.card.addEventListener('pointerup', up); c.card.addEventListener('pointercancel', up)
      return () => { c.card.removeEventListener('pointerdown', dn); c.card.removeEventListener('pointermove', move); c.card.removeEventListener('pointerup', up); c.card.removeEventListener('pointercancel', up) }
    })

    // entrada: cartões abrem em leque com pequeno stagger
    order.forEach((i, k) => {
      C[i].card.style.zIndex = String(n - k); C[i].card.style.opacity = k < vis ? '1' : '0'
      timers.push(setTimeout(() => put(i, k), reduced ? 0 : k * 60))
    })

    return () => {
      dead = true
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
      if (drag) clearTimeout(drag.idle)
      el.classList.remove('drag')
      offs.forEach(f => f())
      api.current = NOOP
    }
    // items só importa por tamanho: os nós são renderizados pelo React, o efeito só anima os wrappers
  }, [n, visible, spread, depth, tilt, threshold])

  const onKeyDown = (e: KeyboardEvent) => {
    if (['ArrowRight', 'ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); api.current.toBack() }
    else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); api.current.toFront() }
  }

  return (
    <div ref={root} role="group" tabIndex={0} aria-label={label} onKeyDown={onKeyDown} className={`fan${size === 'big' ? ' big' : ''}`}>
      {items.map((node, i) => (
        <div key={i} ref={el => { cards.current[i] = el }} className="fan-card">
          <div className="fan-face">{node}<div className="fan-shade" /></div>
        </div>
      ))}
    </div>
  )
}
