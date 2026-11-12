import { useEffect, useState } from 'react'
import { formatMoney } from '@/lib/currency'
import { fixosProgress, isEstimated } from '@/lib/month'
import type { RecurringExpense, Transaction } from '@/types/models'

const C = 226.2

interface Props {
  txs: Transaction[]
  recurring: RecurringExpense[]
  onToggle: (tx: Transaction) => void
  onGenerate: () => void
  generating: boolean
  hasPending?: boolean
  onPending?: () => void
}

export default function FixosCard({ txs, recurring, onToggle, onGenerate, generating, hasPending, onPending }: Props) {
  const p = fixosProgress(txs)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)))
    return () => cancelAnimationFrame(id)
  }, [])
  const money = formatMoney(p.total)
  const cut = money.lastIndexOf(',')

  return (
    <div className="glass rise">
      <div className="fix-top">
        <div>
          <div className="eyebrow plain">Fixos previstos do mês</div>
          <div className="bigv">
            {money.slice(0, cut)}
            <small>{money.slice(cut)}</small>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            <span className="num" style={{ color: 'var(--tx)', fontWeight: 600 }}>{formatMoney(p.paid)}</span> pagos ·{' '}
            <span className="num" style={{ color: 'var(--tx)', fontWeight: 600 }}>{formatMoney(p.pending)}</span> a vencer
          </div>
        </div>
        <div className="fx-ring">
          <svg width="84" height="84" aria-hidden="true">
            <circle cx="42" cy="42" r="36" stroke="rgba(255,255,255,.06)" strokeWidth="6" fill="none" />
            <circle
              cx="42" cy="42" r="36" stroke="#7ee08a" strokeWidth="6" fill="none" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={on ? C * (1 - p.pct / 100) : C}
              className="fx-ring-arc"
            />
          </svg>
          <b>{Math.round(p.pct)}%</b>
        </div>
      </div>
      {hasPending && (
        <button type="button" className="btn line" style={{ marginBottom: 12 }} onClick={onPending}>Informar variáveis</button>
      )}
      <div className="track"><b style={{ width: `${p.pct}%` }} /></div>
      {p.items.length === 0 ? (
        <button type="button" className="btn solid" disabled={generating} onClick={onGenerate}>
          Gerar fixos do mês
        </button>
      ) : (
        <div className="chips">
          {p.items.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip ${t.is_paid ? 'paid' : 'pend'}`}
              aria-pressed={t.is_paid}
              onClick={() => onToggle(t)}
            >
              <i>{t.is_paid ? '✓' : '○'}</i>
              {t.description}
              <span className="num">{isEstimated(t, recurring) && '≈ '}{formatMoney(t.amount).replace(/R\$\s/, '')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
