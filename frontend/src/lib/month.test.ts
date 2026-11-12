import { expect, test } from 'vitest'
import type { RecurringExpense, Transaction } from '@/types/models'
import { catCols, dueList, filterLedger, fixosProgress, groupByDay, isEstimated } from './month'

const tx = (o: Partial<Transaction>): Transaction => ({
  id: 0, type: 'expense', kind: 'fixed', category: null, category_detail: null, description: '', amount: '0.00',
  date: '2026-11-01', year: 2026, month: 11, payment_method: null, payment_method_detail: null, is_paid: false,
  recurring_source: null, is_fixed: true, installment_current: null, installment_total: null, ...o,
})
const txs = [
  tx({ id: 1, amount: '100.00', date: '2026-11-05', is_paid: true, payment_method: 1 }),
  tx({ id: 2, amount: '50.10', date: '2026-11-10', payment_method: 9 }),
  tx({ id: 3, amount: '20.00', date: '2026-11-20', payment_method: 9 }),
  tx({ id: 4, amount: '30.00', date: '2026-11-20', kind: 'variable', is_fixed: false, is_paid: true }),
]

test('fixosProgress', () => {
  const r = fixosProgress(txs)
  expect(r).toMatchObject({ total: '170.10', paid: '100.00', pending: '70.10', pct: 58.8 })
  expect(r.items).toHaveLength(3)
})
test('dueList: overdue first, total = pending', () => {
  const r = dueList(txs, '2026-11-12')
  expect(r.items.map(t => [t.date, t.overdue])).toEqual([['2026-11-10', true], ['2026-11-20', false]])
  expect(r.total).toBe(fixosProgress(txs).pending)
})
test('groupByDay', () => {
  const g = groupByDay([...txs, tx({ id: 5, type: 'income', amount: '10.00', date: '2026-11-20', is_fixed: false })])
  expect(g[0].date).toBe('2026-11-20')
  expect(g[0].total).toBe('-40.00')
  expect(g.map(d => d.date)).toEqual(['2026-11-20', '2026-11-10', '2026-11-05'])
})
test('catCols', () => { expect(catCols(8)).toBe(4); expect(catCols(7)).toBe(3) })
test('filterLedger', () => {
  const cards = filterLedger(txs, 'card', new Set([9]))
  expect(cards.map(t => t.id)).toEqual([2, 3])
  expect(filterLedger(txs, 'all', new Set())).toHaveLength(4)
  expect(filterLedger(txs, 'income', new Set())).toHaveLength(0)
  expect(filterLedger(txs, 'expense', new Set())).toHaveLength(4)
})
test('isEstimated', () => {
  const rec = [{ id: 7, is_variable: true }, { id: 8, is_variable: false }] as RecurringExpense[]
  expect(isEstimated(tx({ recurring_source: 7 }), rec)).toBe(true)
  expect(isEstimated(tx({ recurring_source: 8 }), rec)).toBe(false)
  expect(isEstimated(tx({}), rec)).toBe(false)
})
