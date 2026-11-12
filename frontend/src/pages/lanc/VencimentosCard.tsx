import { formatMoney } from '@/lib/currency'
import { monthLabel } from '@/lib/date'
import { dueList, isEstimated } from '@/lib/month'
import type { RecurringExpense, Transaction } from '@/types/models'

export default function VencimentosCard({ txs, recurring, today }: { txs: Transaction[]; recurring: RecurringExpense[]; today: string }) {
  const { items, total } = dueList(txs, today)
  return (
    <div className="glass rise">
      <div className="card-h"><h3>Próximos vencimentos</h3><span className="muted" style={{ fontSize: 12 }}>{items.length} fixos</span></div>
      <div className="due-list">
        {items.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Nada a vencer</p>}
        {items.map((t) => {
          const est = isEstimated(t, recurring)
          const [, m, d] = t.date.split('-').map(Number)
          const sub = [t.category_detail?.name, est ? 'valor estimado' : t.payment_method_detail?.name].filter(Boolean).join(' · ')
          return (
            <div className="due" key={t.id}>
              <div className="dd"><b>{d}</b><small>{monthLabel(m).toLowerCase()}</small></div>
              <div className="n">
                {t.description}{t.overdue && <span className="tag late">vencido</span>}
                <small>{sub}</small>
              </div>
              <span className="num">{est && '≈ '}{formatMoney(t.amount).replace(/R\$\s/, '')}</span>
            </div>
          )
        })}
      </div>
      <div className="due-foot"><span>Total a vencer</span><span className="num" style={{ color: 'var(--tx)', fontWeight: 600 }}>{formatMoney(total)}</span></div>
    </div>
  )
}
