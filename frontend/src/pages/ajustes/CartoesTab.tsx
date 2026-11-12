import { useEffect, useState } from 'react'
import { usePayInvoice, useCardsSummary, useToggleCardActive } from '@/api/cards'
import Fan from '@/components/fan/Fan'
import MetalCard from '@/components/card/MetalCard'
import { metalRefresh } from '@/components/card/metal'
import Sheet from '@/components/sheet/Sheet'
import Skeleton from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { usePeriod } from '@/contexts/PeriodContext'
import { formatMoney } from '@/lib/currency'
import type { CardSummary } from '@/types/models'
import { CardForm } from './forms'

const FN = { credit: 'Crédito', debit: 'Débito' }

export default function CartoesTab() {
  const { year, month } = usePeriod()
  const { data, isLoading, isError } = useCardsSummary(year, month)
  const toggle = useToggleCardActive()
  const pay = usePayInvoice()
  const [top, setTop] = useState(0)
  const [sheet, setSheet] = useState<CardSummary | 'new' | null>(null)
  useEffect(() => metalRefresh(), [])
  if (isLoading) return <Skeleton className="h-64" />
  if (isError) return <p className="muted">Erro ao carregar cartões</p>

  const all = data ?? []
  const active = all.filter((c) => c.is_active)
  const inactive = all.filter((c) => !c.is_active)
  const c = active[top] ?? active[0]
  const close = () => setSheet(null)
  const setActive = (x: CardSummary, is_active: boolean) =>
    toggle.mutate({ id: x.card_id, is_active }, {
      onSuccess: () => toast(is_active ? 'Cartão reativado' : 'Cartão desativado', 'success'),
      onError: () => toast('Erro ao atualizar cartão', 'error'),
    })
  const onPay = () => {
    const is_paid = !c.invoice.is_paid
    pay.mutate({ cardId: c.card_id, year, month, is_paid }, {
      onSuccess: () => toast(is_paid ? 'Fatura marcada como paga' : 'Fatura reaberta', 'success'),
      onError: () => toast('Erro ao atualizar fatura', 'error'),
    })
  }

  return (
    <>
      <div className="bar"><button type="button" className="btn solid" onClick={() => setSheet('new')}>+ Novo cartão</button></div>
      {active.length === 0 && <p className="muted">Nenhum cartão ativo.</p>}
      {c && (
        <div className="cpane">
          <Fan
            key={active.map((x) => x.card_id).join()}
            size="big"
            onChange={setTop}
            items={active.map((x) => <MetalCard key={x.card_id} card={{ name: x.name, bank: x.bank, due_day: x.due_day }} />)}
          />
          <div className="cinfo" key={c.card_id}>
            <div className="cn">{c.name}</div>
            <div className="kvs">
              <div><small>Fechamento</small><b>dia {c.closing_day}</b></div>
              <div><small>Vencimento</small><b>dia {c.due_day}</b></div>
              <div><small>Limite</small><b className="num">{c.limit ? formatMoney(c.limit) : '—'}</b></div>
              <div><small>Funções</small><b>{c.functions.map((f) => FN[f]).join(' · ')}</b></div>
            </div>
            <div className="cbtn">
              {c.functions.includes('credit') && (
                <button type="button" className="btn line" disabled={pay.isPending} onClick={onPay}>
                  {c.invoice.is_paid ? 'Fatura paga ✓' : 'Marcar fatura paga'}
                </button>
              )}
              <button type="button" className="btn" onClick={() => setSheet(c)}>Editar</button>
              <button type="button" className="btn line" onClick={() => setActive(c, false)}>Desativar</button>
            </div>
          </div>
        </div>
      )}
      {inactive.length > 0 && (
        <>
          <div className="inactive-h">Inativos</div>
          <div className="rows">
            {inactive.map((x) => (
              <div key={x.card_id} className="rw off">
                <div className="ic card" style={{ background: x.color }} />
                <div className="tt"><b>{x.name}</b><small>fatura fecha dia {x.closing_day} · vence dia {x.due_day}</small></div>
                <button type="button" className="btn line end" onClick={() => setActive(x, true)}>Reativar</button>
              </div>
            ))}
          </div>
        </>
      )}
      <Sheet open={sheet != null} onClose={close} title="Cartão">
        {sheet != null && <CardForm key={sheet === 'new' ? 'new' : sheet.card_id} item={sheet === 'new' ? undefined : sheet} onDone={close} />}
      </Sheet>
    </>
  )
}
