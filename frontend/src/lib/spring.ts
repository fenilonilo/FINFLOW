export type Spring = { p: number; v: number; t: number; k: number; c: number }

export const spring = (p: number, k: number, c: number): Spring => ({ p, v: 0, t: p, k, c })

/** Semi-implicit Euler, 240 Hz sub-steps. Returns true while any spring is moving. */
export function stepSprings(springs: Spring[], dt: number, eps = { p: 0.01, v: 0.05 }): boolean {
  dt = Math.min(0.05, dt)
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n
  let busy = false
  for (const s of springs) {
    for (let i = 0; i < n; i++) {
      s.v += (s.k * (s.t - s.p) - s.c * s.v) * h
      s.p += s.v * h
    }
    if (Math.abs(s.t - s.p) < eps.p && Math.abs(s.v) < eps.v) { s.p = s.t; s.v = 0 } else busy = true
  }
  return busy
}
