// Exact decimal math on strings via BigInt cents.
const toCents = (s: string): bigint => {
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(s.trim())
  if (!m) throw new Error(`invalid money: ${s}`)
  const c = BigInt((m[2] || '0') + ((m[3] ?? '') + '00').slice(0, 2))
  return m[1] ? -c : c
}

const fromCents = (c: bigint): string => {
  const neg = c < 0n
  const abs = (neg ? -c : c).toString().padStart(3, '0')
  return `${neg ? '-' : ''}${abs.slice(0, -2)}.${abs.slice(-2)}`
}

export const sumMoney = (values: string[]): string => fromCents(values.reduce((a, v) => a + toCents(v), 0n))
export const subMoney = (a: string, b: string): string => fromCents(toCents(a) - toCents(b))
export const cmpMoney = (a: string, b: string): -1 | 0 | 1 => {
  const d = toCents(a) - toCents(b)
  return d < 0n ? -1 : d > 0n ? 1 : 0
}
export const pct = (part: string, whole: string): number => {
  const w = toCents(whole)
  return w === 0n ? 0 : Math.round((Number(toCents(part)) / Number(w)) * 1000) / 10
}
