import { expect, test } from 'vitest'
import type { MonthSummary } from '@/types/models'
import { buildSeries, headline, projectNext, type MonthPoint } from './overview'

const sum = (year: number, month: number, f: string, v: string, i = '5000.00') =>
  ({ year, month, total_fixed: f, total_variable: v, total_income: i }) as MonthSummary
const pt = (month: number, f: string, v: string): MonthPoint =>
  ({ year: 2026, month, fixed: f, variable: v, income: '5000.00', projected: false })

test('buildSeries sorts chronologically', () => {
  const s = buildSeries([sum(2026, 1, '1', '2'), sum(2025, 12, '3', '4')])
  expect(s.map(p => [p.year, p.month])).toEqual([[2025, 12], [2026, 1]])
  expect(s[0]).toEqual({ year: 2025, month: 12, fixed: '3', variable: '4', income: '5000.00', projected: false })
})
test('projectNext uses same month last year', () => {
  const months = [[2025, 11], [2025, 12], ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(m => [2026, m])]
  const series = buildSeries(months.map(([y, m]) => sum(y, m, '900.00', y === 2025 && m === 12 ? '812.34' : '100.00', m === 11 && y === 2026 ? '6000.00' : '5000.00')))
  expect(series).toHaveLength(13)
  expect(projectNext(series, '1000.00')).toEqual({ year: 2026, month: 12, fixed: '1000.00', variable: '812.34', income: '6000.00', projected: true })
})
test('projectNext falls back to 6-month average, rounded to cent', () => {
  const s3 = [pt(9, '1', '100.00'), pt(10, '1', '200.00'), pt(11, '1', '200.01')]
  expect(projectNext(s3, '1000.00').variable).toBe('166.67')
  const s8 = [1, 2, 3, 4, 5, 6, 7, 8].map(m => pt(m, '1', m <= 2 ? '1000.00' : '10.00'))
  expect(projectNext(s8, '1').variable).toBe('10.00')
})
test('projectNext rolls year', () => {
  const p = projectNext([{ ...pt(12, '1', '10.00') }], '1.00')
  expect([p.year, p.month]).toEqual([2027, 1])
})
test('headline', () => {
  const oct = pt(10, '400.00', '400.00'), nov = pt(11, '400.00', '300.00')
  expect(headline(nov, oct)).toEqual({ spent: '700.00', deltaPct: -12.5, left: '4300.00', projected: false })
  expect(headline(nov, undefined).deltaPct).toBeNull()
  expect(headline(nov, pt(10, '0.00', '0.00')).deltaPct).toBeNull()
})
