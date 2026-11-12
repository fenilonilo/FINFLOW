import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react'
import { spring, stepSprings } from '@/lib/spring'
import { clamp, isBack, releaseTarget, snap } from './flipMath'

export type FlipHandle = { flipFront(): void }
type Grip = { id: number; x: number; base: number; moved: boolean; slop: number; hist: { t: number; v: number }[] }

const FlipCard = forwardRef<FlipHandle, { front: ReactNode; back: ReactNode; className?: string }>(
  function FlipCard({ front, back, className = '' }, ref) {
    const root = useRef<HTMLDivElement>(null)
    const rot = useRef<HTMLDivElement>(null)
    const sh = useRef<HTMLSpanElement>(null)
    const faces = useRef<(HTMLDivElement | null)[]>([])
    const api = useRef<FlipHandle>({ flipFront() {} })
    useImperativeHandle(ref, () => ({ flipFront: () => api.current.flipFront() }), [])

    useEffect(() => {
      const el = root.current!, r = rot.current!, s = sh.current!
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      const turn = spring(0, 170, 20), tx = spring(0, 400, 40), ty = spring(0, 400, 40)
      const lift = spring(1, 320, 26), sheen = spring(0, 320, 26)
      const others = [tx, ty, lift, sheen]
      let raf = 0, last = 0, grip: Grip | null = null, held = false

      const wake = () => { if (!raf) raf = requestAnimationFrame(loop) }
      function loop(now: number) {
        raf = 0
        const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60); last = now
        let busy = held
        if (!held && stepSprings([turn], dt)) busy = true
        if (stepSprings(others, dt)) busy = true
        draw()
        if (busy) raf = requestAnimationFrame(loop); else last = 0
      }
      function draw() {
        r.style.transform = `perspective(1100px) scale(${lift.p}) rotateX(${tx.p}deg) rotateY(${turn.p + ty.p}deg)`
        r.style.setProperty('--sheen', String(sheen.p))
        const f = Math.abs(Math.cos((turn.p * Math.PI) / 180))
        s.style.transform = `scaleX(${0.08 + 0.92 * f})`
        s.style.opacity = String(0.1 + 0.9 * f * f)
      }
      function settle(to: number, v = 0) {
        held = false; turn.t = to; turn.v = v
        if (reduced) { turn.p = to; turn.v = 0; draw() } else wake()
        const b = isBack(to)
        faces.current.forEach((f, i) => {
          if (!f) return
          const hidden = i === 0 ? b : !b
          if (hidden) f.setAttribute('inert', ''); else f.removeAttribute('inert')
          f.setAttribute('aria-hidden', String(hidden))
        })
        el.setAttribute('aria-pressed', String(b))
      }
      const flip = () => { const base = snap(turn.t); settle(isBack(base) ? base - 180 : base + 180) }
      const rest = () => { tx.t = ty.t = sheen.t = 0; lift.t = 1; if (!reduced) wake() }

      const down = (e: PointerEvent) => {
        if (e.button !== 0 || grip || (e.target as Element).closest('button')) return
        try { el.setPointerCapture(e.pointerId) } catch { /* sem captura */ }
        grip = { id: e.pointerId, x: e.clientX, base: turn.p, moved: false, slop: e.pointerType === 'touch' ? 8 : 4, hist: [] }
        if (!reduced) { lift.t = 1.03; wake() }
      }
      const move = (e: PointerEvent) => {
        const g = grip
        if (g && g.id === e.pointerId) {
          const d = e.clientX - g.x
          if (!g.moved) {
            if (Math.abs(d) < g.slop) return
            g.moved = true; held = true; el.classList.add('drag'); tx.t = ty.t = sheen.t = 0
          }
          turn.p = turn.t = g.base + (d / (el.offsetWidth || 206)) * 180; turn.v = 0
          const now = performance.now()
          g.hist.push({ t: now, v: turn.p })
          while (g.hist.length > 2 && now - g.hist[0].t > 90) g.hist.shift()
          if (reduced) draw(); else wake()
          return
        }
        if (e.pointerType === 'touch' || reduced) return
        const b = el.getBoundingClientRect()
        const px = clamp((e.clientX - b.left) / b.width, 0, 1), py = clamp((e.clientY - b.top) / b.height, 0, 1)
        tx.t = (0.5 - py) * 24; ty.t = (px - 0.5) * 24; sheen.t = 1; lift.t = 1.03
        r.style.setProperty('--gx', px * 100 + '%'); r.style.setProperty('--gy', py * 100 + '%'); wake()
      }
      const release = (e: PointerEvent, cancel: boolean) => {
        const g = grip
        if (!g || g.id !== e.pointerId) return
        grip = null; el.classList.remove('drag')
        if (e.pointerType === 'touch' || !el.matches(':hover')) rest()
        if (!g.moved) { if (cancel) settle(turn.t); else flip(); return }
        const a = g.hist[0], b = g.hist[g.hist.length - 1]
        const v = !cancel && a && b && b.t > a.t && performance.now() - b.t < 60 ? ((b.v - a.v) / (b.t - a.t)) * 1000 : 0
        settle(cancel ? snap(g.base) : releaseTarget(turn.p, v), v)
      }
      const up = (e: PointerEvent) => release(e, false)
      const cancel = (e: PointerEvent) => release(e, true)
      const leave = () => { if (!grip) rest() }
      const key = (e: KeyboardEvent) => {
        if (e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (!e.repeat) flip() }
      }
      el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', cancel)
      el.addEventListener('pointerleave', leave); el.addEventListener('keydown', key)
      api.current = { flipFront: () => { if (isBack(turn.t)) flip() } }
      settle(0); draw()
      return () => {
        cancelAnimationFrame(raf)
        el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel)
        el.removeEventListener('pointerleave', leave); el.removeEventListener('keydown', key)
      }
    }, [])

    return (
      <div ref={root} className={`flip ${className}`} role="button" tabIndex={0} aria-pressed="false" aria-label="Conta: clique para virar">
        <span ref={sh} className="flip-sh" />
        <div ref={rot} className="flip-rot">
          <div ref={(n) => { faces.current[0] = n }} className="flip-face front">{front}<span className="flip-gl" /></div>
          <div ref={(n) => { faces.current[1] = n }} className="flip-face back">{back}<span className="flip-gl" /></div>
        </div>
      </div>
    )
  },
)
export default FlipCard
