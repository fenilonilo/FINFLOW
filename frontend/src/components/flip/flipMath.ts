export const snap = (deg: number) => Math.round(deg / 180) * 180
export const isBack = (deg: number) => Math.abs(Math.round(deg / 180)) % 2 === 1
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const releaseTarget = (here: number, velocityDegPerS: number) =>
  clamp(snap(here + velocityDegPerS * 0.16), snap(here) - 180, snap(here) + 180)
