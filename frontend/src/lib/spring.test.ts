import { expect, test } from 'vitest'
import { spring, stepSprings } from './spring'

test('spring settles on target', () => {
  const s = spring(0, 170, 20); s.t = 180
  let i = 0
  while (stepSprings([s], 1 / 60) && i++ < 600);
  expect(s.p).toBe(180); expect(s.v).toBe(0)
})
test('stepSprings reports idle when at rest', () => expect(stepSprings([spring(1, 320, 26)], 1 / 60)).toBe(false))
test('dt is clamped to 0.05', () => {
  const a = spring(0, 100, 10); a.t = 10
  const b = spring(0, 100, 10); b.t = 10
  stepSprings([a], 5); stepSprings([b], 0.05)
  expect(a.p).toBe(b.p)
})
