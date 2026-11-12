import { useState } from 'react'
import { useDeleteRecurring, useRecurring, useUpdateRecurring, usePauseRecurring } from '@/api/catalog'
import Sheet from '@/components/sheet/Sheet'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Skeleton from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { formatMoney } from '@/lib/currency'
import { sumMoney } from '@/lib/money'
import type { RecurringExpense } from '@/types/models'
import { FixoForm } from './forms'

const bare = (v: string) => formatMoney(v).replace(/^R\$\s*/, '')

export default function FixosTab() {
  const { data, isLoading, isError } = useRecurring()
  const pause = usePauseRecurring()
  const resume = useUpdateRecurring()
  const del = useDeleteRecurring()
  const [sheet, setSheet] = useState<RecurringExpense | 'new' | null>(null)
  const [removing, setRemoving] = useState<RecurringExpense | null>(null)
  if (isLoading) return <Skeleton className="h-40" />
  if (isError) return <p className="muted">Erro ao carregar fixos</p>

  const list = [...(data?.results ?? [])].sort((a, b) => a.due_day - b.due_day)
  const total = sumMoney(list.filter((r) => r.type === 'expense' && r.status === 'active' && r.default_amount).map((r) => r.default_amount!))
  const close = () => setSheet(null)
  const fail = (m: string) => ({ onError: () => toast(m, 'error') })

  return (
    <>
      <div className="bar"><button type="button" className="btn solid" onClick={() => setSheet('new')}>+ Novo fixo</button></div>
      <div className="rows">
        {list.map((r) => {
          const off = r.status === 'paused'
          return (
            <div key={r.id} className={`rw${off ? ' off' : ''}`}>
              <div className="dd"><b>{String(r.due_day).padStart(2, '0')}</b><small>dia</small></div>
              <div className="tt">
                <b>{r.description}</b>
                <small>{r.category_detail?.name ?? 'Sem categoria'} · {r.type === 'income' ? 'receita' : r.is_variable ? 'valor estimado' : r.payment_method_detail?.name ?? 'sem forma'}</small>
              </div>
              <span className="end">{r.default_amount ? `${r.type === 'income' ? '+ ' : ''}${r.is_variable ? '≈ ' : ''}${bare(r.default_amount)}` : '—'}</span>
              <div className="acts">
                <button type="button" className="btn line" onClick={() => setSheet(r)}>Editar</button>
                {off
                  ? <button type="button" className="btn line" onClick={() => resume.mutate({ id: r.id, status: 'active' }, { onSuccess: () => toast('Fixo reativado', 'success'), ...fail('Erro ao reativar') })}>Reativar</button>
                  : <button type="button" className="btn line" onClick={() => pause.mutate(r.id, { onSuccess: () => toast('Fixo pausado', 'success'), ...fail('Erro ao pausar') })}>Pausar</button>}
                <button type="button" className="btn line" onClick={() => setRemoving(r)}>Excluir</button>
              </div>
            </div>
          )
        })}
        {list.length === 0 && <p className="muted">Nenhum gasto fixo ainda.</p>}
        {list.length > 0 && <div className="rw total"><div className="dd" /><div className="tt">Total previsto</div><span className="end">{formatMoney(total)}</span></div>}
      </div>
      <Sheet open={sheet != null} onClose={close} title="Gasto fixo">
        {sheet != null && <FixoForm key={sheet === 'new' ? 'new' : sheet.id} item={sheet === 'new' ? undefined : sheet} onDone={close} />}
      </Sheet>
      <ConfirmDialog
        open={removing != null}
        title="Excluir fixo?"
        description={`"${removing?.description}" deixa de ser gerado nos próximos meses.`}
        confirmLabel="Excluir"
        onCancel={() => setRemoving(null)}
        onConfirm={() => { const r = removing!; setRemoving(null); del.mutate(r.id, { onSuccess: () => toast('Fixo excluído', 'success'), ...fail('Erro ao excluir') }) }}
      />
    </>
  )
}
