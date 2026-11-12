import type { RecurringExpense, Transaction } from '@/types/models'
import { pct, sumMoney } from './money'

export const isEstimated = (tx: Transaction, recurring: RecurringExpense[]): boolean =>
  tx.recurring_source != null && !!recurring.find(r => r.id === tx.recurring_source)?.is_variable

const fixedExpenses = (txs: Transaction[]) => txs.filter(t => t.is_fixed && t.type === 'expense')

export function fixosProgress(txs: Transaction[]) {
  const items = fixedExpenses(txs)
  const total = sumMoney(items.map(t => t.amount))
  const paid = sumMoney(items.filter(t => t.is_paid).map(t => t.amount))
  const pending = sumMoney(items.filter(t => !t.is_paid).map(t => t.amount))
  return { total, paid, pending, pct: pct(paid, total), items }
}

export function dueList(txs: Transaction[], today: string) {
  const items = fixedExpenses(txs)
    .filter(t => !t.is_paid)
    .map(t => ({ ...t, overdue: t.date < today }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.date.localeCompare(b.date))
  return { items, total: sumMoney(items.map(t => t.amount)) }
}

export function groupByDay(txs: Transaction[]) {
  const days = new Map<string, Transaction[]>()
  for (const t of txs) days.set(t.date, [...(days.get(t.date) ?? []), t])
  return [...days]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      items,
      total: sumMoney(items.map(t => (t.type === 'income' ? t.amount : `-${t.amount}`))),
    }))
}

export type LedgerFilter = 'all' | 'income' | 'expense' | 'card'

export function filterLedger(txs: Transaction[], f: LedgerFilter, cardPmIds: Set<number>): Transaction[] {
  if (f === 'all') return txs
  if (f === 'card') return txs.filter(t => t.payment_method != null && cardPmIds.has(t.payment_method))
  return txs.filter(t => t.type === f)
}

export const catCols = (n: number): 3 | 4 => (n % 2 === 0 ? 4 : 3)

