import { useState } from 'react'
import { formatMoney } from '@/lib/currency'
import { monthLabel } from '@/lib/date'
import { filterLedger, groupByDay, type LedgerFilter } from '@/lib/month'
import type { Category, PaymentMethod, Transaction } from '@/types/models'

const FILTERS: Array<[LedgerFilter, string]> = [['all', 'Todas'], ['income', 'Entradas'], ['expense', 'Saídas'], ['card', 'Cartão']]
const plain = (s: string) => formatMoney(s).replace(/R\$\s/, '')
const signed = (s: string) => (s.startsWith('-') ? '− ' : '+ ') + plain(s.replace('-', ''))

interface Props {
  txs: Transaction[]
  cats: Category[]
  pms: PaymentMethod[]
  today: string
  onEdit: (tx: Transaction) => void
  onTogglePaid: (tx: Transaction) => void
}

export default function Ledger({ txs, cats, pms, today, onEdit, onTogglePaid }: Props) {
  const [filter, setFilter] = useState<LedgerFilter>('all')
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState(false)
  const [cat, setCat] = useState('')
  const [pm, setPm] = useState('')
  const [paid, setPaid] = useState('')
  const cardIds = new Set(pms.filter((p) => p.card_detail).map((p) => p.id))
  const needle = q.trim().toLowerCase()
  const shown = filterLedger(txs, filter, cardIds).filter(
    (t) =>
      (!needle || t.description.toLowerCase().includes(needle)) &&
      (!cat || t.category === Number(cat)) &&
      (!pm || t.payment_method === Number(pm)) &&
      (!paid || t.is_paid === (paid === 'paid')),
  )
  const days = groupByDay(shown)

  return (
    <div className="glass rise movs ledger">
      <div className="card-h">
        <h3>Movimentações</h3>
        <div className="filters">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
          <input aria-label="Buscar" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className={menu ? 'on' : ''} aria-expanded={menu} onClick={() => setMenu(!menu)}>Filtros</button>
        </div>
      </div>
      {menu && (
        <div className="fmenu">
          <select aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas as categorias</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Forma de pagamento" value={pm} onChange={(e) => setPm(e.target.value)}>
            <option value="">Todas as formas</option>
            {pms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select aria-label="Situação" value={paid} onChange={(e) => setPaid(e.target.value)}>
            <option value="">Pagos e pendentes</option>
            <option value="paid">Pagos</option>
            <option value="unpaid">Não pagos</option>
          </select>
        </div>
      )}
      <div className="lh"><span /><span>Descrição</span><span>Categoria</span><span>Pagamento</span><span>Valor</span></div>
      {days.length === 0 && <p className="muted" style={{ fontSize: 13, padding: '16px 0' }}>Nenhuma movimentação</p>}
      {days.map((d) => {
        const [, m, dd] = d.date.split('-').map(Number)
        const label = `${String(dd).padStart(2, '0')} ${monthLabel(m).toLowerCase()}`
        return (
          <div key={d.date}>
            <div className="day"><span>{d.date === today ? `Hoje · ${label}` : label}</span><span className="num">{signed(d.total)}</span></div>
            {d.items.map((t) => (
              <div key={t.id} className="tx" role="button" tabIndex={0} onClick={() => onEdit(t)} onKeyDown={(e) => e.target === e.currentTarget && e.key === 'Enter' && onEdit(t)}>
                <button
                  type="button"
                  className={`mk${t.is_paid ? ' paid' : ''}`}
                  aria-label={t.is_paid ? 'Marcar como pendente' : 'Marcar como pago'}
                  onClick={(e) => { e.stopPropagation(); onTogglePaid(t) }}
                >
                  {t.is_paid ? '✓' : '○'}
                </button>
                <div className="d">
                  {t.description}
                  {t.is_fixed && <span className="tag">fixo</span>}
                  {t.installment_total != null && t.installment_total > 1 && <span className="tag inst">{t.installment_current}/{t.installment_total}</span>}
                </div>
                <div className="c2">{t.category_detail?.name ?? '—'}</div>
                <div className="pm">
                  {t.payment_method != null && cardIds.has(t.payment_method) && (
                    <span className="pill-card" style={{ background: t.payment_method_detail?.color }} />
                  )}
                  {t.payment_method_detail?.name ?? '—'}
                </div>
                <div className={`a${t.type === 'income' ? ' in' : ''}`}>{t.type === 'income' ? '+ ' : '− '}{plain(t.amount)}</div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
