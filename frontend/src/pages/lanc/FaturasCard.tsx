import { useEffect, useState } from 'react'
import Fan from '@/components/fan/Fan'
import MetalCard from '@/components/card/MetalCard'
import { usePayInvoice } from '@/api/cards'
import { toast } from '@/components/ui/Toast'
import { formatMoney } from '@/lib/currency'
import { monthLabel } from '@/lib/date'
import type { CardSummary } from '@/types/models'

export default function FaturasCard({ cards, year, month }: { cards: CardSummary[]; year: number; month: number }) {
  const credit = cards.filter((c) => c.functions.includes('credit'))
  const [top, setTop] = useState(0)
  const ids = credit.map((x) => x.card_id).join()
  useEffect(() => setTop(0), [ids])
  const pay = usePayInvoice()
  const c = credit[top] ?? credit[0]

  function onPay() {
    const is_paid = !c.invoice.is_paid
    pay.mutate(
      { cardId: c.card_id, year, month, is_paid },
      {
        onSuccess: () => toast(is_paid ? 'Fatura marcada como paga' : 'Fatura reaberta', 'success'),
        onError: () => toast('Erro ao atualizar fatura', 'error'),
      },
    )
  }

  const pctUsed = c?.limit != null && c.committed_pct != null ? parseFloat(c.committed_pct) : null
  const close = c ? c.invoice.cycle_end.split('-').map(Number) : []

  return (
    <div className="glass rise">
      <div className="card-h"><h3>Faturas abertas</h3>{credit.length > 1 && <span className="muted" style={{ fontSize: 12 }}>arraste o cartão para trocar</span>}</div>
      {!c ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhum cartão de crédito</p>
      ) : (
        <div className="fanwrap">
          <Fan
            label="Faturas abertas"
            items={credit.map((x) => <MetalCard key={x.card_id} card={{ name: x.name, bank: x.bank, due_day: x.due_day }} />)}
            onChange={setTop}
          />
          <div className="finfo">
            <small>Fatura atual · {c.name}</small>
            <div className="v">{formatMoney(c.invoice.amount)}</div>
            <small>fecha {close[2]} {monthLabel(close[1]).toLowerCase()} · vence dia {c.due_day}</small>
            {pctUsed != null && (
              <>
                <div className="lim"><b style={{ width: `${Math.min(100, pctUsed)}%`, background: pctUsed >= 90 ? '#e0a050' : 'var(--g)' }} /></div>
                <small style={{ marginTop: 6 }}>Limite {formatMoney(c.limit!)} · {Math.round(pctUsed)}% usado</small>
              </>
            )}
            {pctUsed != null && pctUsed >= 90 && <div className="warn">limite quase esgotado</div>}
            {c.invoice.divergent && <div className="warn">fatura divergente</div>}
            <button type="button" className="btn line" style={{ marginTop: 12 }} disabled={pay.isPending} onClick={onPay}>
              {c.invoice.is_paid ? 'Fatura paga ✓' : 'Marcar fatura paga'}
            </button>
            <div className="dots">{credit.map((x, i) => <i key={x.card_id} className={i === top ? 'on' : ''} />)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
