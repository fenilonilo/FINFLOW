import { useState } from 'react'
import Sheet from '@/components/sheet/Sheet'
import { useGenerateVariables } from '@/api/months'
import { toast } from '@/components/ui/Toast'
import { parseMoney } from '@/lib/currency'
import type { PendingVariable } from '@/types/models'

interface Props {
  items: PendingVariable[]
  year: number
  month: number
  onClose: () => void
  onDone: () => void
}

export default function VariablesSheet({ items, year, month, onClose, onDone }: Props) {
  const gen = useGenerateVariables(year, month)
  const [vals, setVals] = useState<Record<number, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.suggested_amount ?? ''])),
  )
  const ok = items.every((i) => /\d/.test(vals[i.id] ?? ''))

  async function confirm() {
    try {
      await gen.mutateAsync(items.map((i) => ({ recurring_id: i.id, amount: parseMoney(vals[i.id]) })))
      toast('Valores variáveis gerados', 'success')
      onDone()
      onClose()
    } catch {
      toast('Erro ao gerar valores variáveis', 'error')
    }
  }

  return (
    <Sheet open onClose={onClose} title="Valores variáveis do mês">
      <div className="eyebrow">Valores variáveis do mês</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '22px 0' }}>
        {items.map((i) => (
          <label key={i.id} style={{ display: 'block', fontSize: 13 }}>
            {i.description} <span className="muted">· dia {i.due_day}</span>
            <input
              inputMode="decimal"
              value={vals[i.id]}
              onChange={(e) => setVals({ ...vals, [i.id]: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 outline-none"
              style={{ marginTop: 6 }}
            />
          </label>
        ))}
      </div>
      <button type="button" className="btn solid" disabled={!ok || gen.isPending} onClick={confirm}>Confirmar valores</button>
    </Sheet>
  )
}
