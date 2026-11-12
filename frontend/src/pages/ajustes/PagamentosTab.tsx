import { useState } from 'react'
import { useCards } from '@/api/cards'
import { usePaymentMethods } from '@/api/catalog'
import Sheet from '@/components/sheet/Sheet'
import Skeleton from '@/components/ui/Skeleton'
import { IconComponent } from '@/components/ui/IconPicker'
import type { PaymentMethod } from '@/types/models'
import { MethodForm } from './forms'

export default function PagamentosTab() {
  const { data, isLoading, isError } = usePaymentMethods()
  const cards = useCards().data?.results ?? []
  const [sheet, setSheet] = useState<PaymentMethod | 'new' | null>(null)
  if (isLoading) return <Skeleton className="h-40" />
  if (isError) return <p className="muted">Erro ao carregar formas de pagamento</p>
  const pms = (data?.results ?? []).filter((p) => !p.is_archived)
  const close = () => setSheet(null)

  function detail(p: PaymentMethod) {
    if (!p.card_detail) return 'à vista'
    if (p.card_function === 'debit') return 'à vista · conta corrente'
    const due = cards.find((c) => c.id === p.card_detail!.id)?.due_day
    return `fatura fecha dia ${p.card_detail.closing_day}${due ? ` · vence dia ${due}` : ''}`
  }

  return (
    <>
      <div className="bar"><button type="button" className="btn solid" onClick={() => setSheet('new')}>+ Nova forma</button></div>
      <div className="rows">
        {pms.map((p) => (
          <div key={p.id} className="rw">
            {p.card_detail
              ? <div className="ic card" style={{ background: p.card_detail.color }} />
              : <div className="ic" style={{ color: p.color }}><IconComponent name={p.icon} size={16} /></div>}
            <div className="tt"><b>{p.name}</b><small>{detail(p)}</small></div>
            {!p.card_detail && <button type="button" className="btn line end" onClick={() => setSheet(p)}>Editar</button>}
          </div>
        ))}
      </div>
      <Sheet open={sheet != null} onClose={close} title="Forma de pagamento">
        {sheet != null && <MethodForm key={sheet === 'new' ? 'new' : sheet.id} item={sheet === 'new' ? undefined : sheet} onDone={close} />}
      </Sheet>
    </>
  )
}
