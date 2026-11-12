import type { MonthSummary } from '@/types/models'
import { subMoney, sumMoney } from './money'

export type MonthPoint = { year: number; month: number; fixed: string; variable: string; income: string; projected: boolean }

export const buildSeries = (summaries: MonthSummary[]): MonthPoint[] =>
  summaries
    .map(s => ({ year: s.year, month: s.month, fixed: s.total_fixed, variable: s.total_variable, income: s.total_income, projected: false }))
    .sort((a, b) => a.year - b.year || a.month - b.month)

const fromCents = (c: number) => (c / 100).toFixed(2)

export function projectNext(series: MonthPoint[], activeFixedTotal: string): MonthPoint {
  const last = series[series.length - 1]
  const [year, month] = last.month === 12 ? [last.year + 1, 1] : [last.year, last.month + 1]
  const prevYear = series.find(p => p.year === year - 1 && p.month === month)
  let variable: string
  if (prevYear) variable = prevYear.variable
  else {
    const recent = series.slice(-6)
    const cents = Number(sumMoney(recent.map(p => p.variable)).replace('.', ''))
    variable = fromCents(Math.round(cents / recent.length))
  }
  return { year, month, fixed: activeFixedTotal, variable, income: last.income, projected: true }
}

export function headline(p: MonthPoint, prev: MonthPoint | undefined) {
  const spent = sumMoney([p.fixed, p.variable])
  const prevSpent = prev ? sumMoney([prev.fixed, prev.variable]) : null
  const prevNum = prevSpent == null ? 0 : Number(prevSpent)
  const deltaPct = prevNum === 0 ? null : Math.round(((Number(spent) - prevNum) / prevNum) * 1000) / 10
  return { spent, deltaPct, left: subMoney(p.income, spent), projected: p.projected }
}
