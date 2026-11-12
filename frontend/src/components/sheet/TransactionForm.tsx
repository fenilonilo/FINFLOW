import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCategories, usePaymentMethods } from '@/api/catalog'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
} from '@/api/transactions'
import { usePeriod } from '@/contexts/PeriodContext'
import { invoiceMonthLabel } from '@/lib/cardCycle'
import { parseMoney } from '@/lib/currency'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { toast } from '@/components/ui/Toast'
import type { Transaction } from '@/types/models'

const schema = z.object({
  amount: z.string().refine((v) => /\d/.test(v) && Number(parseMoney(v)) > 0, 'Informe o valor'),
  type: z.enum(['income', 'expense']),
  description: z.string().trim().min(1, 'Informe a descrição'),
  date: z.string().min(1, 'Informe a data'),
  category: z.number().nullable(),
  payment_method: z.number().nullable(),
  is_paid: z.boolean(),
  installments: z.number().int().min(1).max(48),
})
type FormData = z.infer<typeof schema>

const PRESETS = [1, 3, 6, 10]
const pad = (n: number) => String(n).padStart(2, '0')

function defaultDate(year: number, month: number) {
  const t = new Date()
  const inPeriod = t.getFullYear() === year && t.getMonth() + 1 === month
  return `${year}-${pad(month)}-${pad(inPeriod ? t.getDate() : 1)}`
}

const pillCls = (on: boolean) =>
  `rounded-full border px-3 py-2 text-[13px] font-medium transition-all ${
    on
      ? 'border-[rgba(126,224,138,.35)] bg-[rgba(126,224,138,.1)] text-[var(--tx)]'
      : 'border-white/10 text-[var(--mu)]'
  }`
const labelCls = 'mb-1.5 block text-xs font-medium text-[var(--mu)]'
const inputCls =
  'w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 outline-none focus:border-[rgba(126,224,138,.45)]'

interface Props {
  tx?: Transaction
  onDone: () => void
}

export default function TransactionForm({ tx, onDone }: Props) {
  const { year, month } = usePeriod()
  const { data: cats } = useCategories()
  const { data: pms } = usePaymentMethods()
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const del = useDeleteTransaction()
  const [confirmDel, setConfirmDel] = useState(false)
  const [custom, setCustom] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: tx
      ? {
          amount: tx.amount.replace('.', ','),
          type: tx.type,
          description: tx.description,
          date: tx.date,
          category: tx.category,
          payment_method: tx.payment_method,
          is_paid: tx.is_paid,
          installments: 1,
        }
      : {
          amount: '',
          type: 'expense',
          description: '',
          date: defaultDate(year, month),
          category: null,
          payment_method: null,
          is_paid: false,
          installments: 1,
        },
  })
  const [type, categoryId, pmId, installments, date] = watch([
    'type',
    'category',
    'payment_method',
    'installments',
    'date',
  ])
  const pm = pms?.results.find((p) => p.id === pmId)
  const isCredit = !!pm?.card_detail && pm.card_function === 'credit'

  async function onSubmit(d: FormData) {
    const payload: Partial<Transaction> = {
      type: d.type,
      description: d.description,
      amount: parseMoney(d.amount),
      date: d.date,
      category: d.category,
      payment_method: d.payment_method,
      is_paid: d.is_paid,
    }
    try {
      if (tx) await update.mutateAsync({ id: tx.id, ...payload })
      else {
        if (isCredit && d.installments > 1) payload.installments = d.installments
        await create.mutateAsync(payload)
      }
      toast(tx ? 'Lançamento atualizado' : 'Lançamento salvo', 'success')
      onDone()
    } catch {
      toast('Erro ao salvar lançamento', 'error')
    }
  }

  async function onDelete() {
    try {
      await del.mutateAsync(tx!.id)
      toast('Lançamento removido', 'success')
      onDone()
    } catch {
      toast('Erro ao remover', 'error')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="mb-[18px] mt-4 flex items-baseline gap-2 border-b border-[var(--line)] pb-3.5 pt-1.5 text-[50px] font-medium tabular-nums tracking-tight">
        <span className="text-xl text-[var(--mu)]">R$</span>
        <input
          aria-label="Valor"
          inputMode="decimal"
          placeholder="0,00"
          autoComplete="off"
          className="w-full bg-transparent outline-none"
          {...register('amount')}
        />
      </div>
      {errors.amount && (
        <p role="alert" className="-mt-3 mb-3 text-xs text-danger">
          {errors.amount.message}
        </p>
      )}

      <div className="mb-3.5 flex gap-1.5">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            className={pillCls(type === t)}
            onClick={() => setValue('type', t)}
          >
            {t === 'expense' ? 'Saída' : 'Entrada'}
          </button>
        ))}
      </div>

      <label className="mb-3 block">
        <span className={labelCls}>Descrição</span>
        <input className={inputCls} {...register('description')} />
        {errors.description && (
          <span role="alert" className="text-xs text-danger">
            {errors.description.message}
          </span>
        )}
      </label>

      <label className="mb-3 block">
        <span className={labelCls}>Data</span>
        <input type="date" className={inputCls} {...register('date')} />
      </label>

      <div className={labelCls}>Categoria</div>
      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {cats?.results
          .filter((c) => !c.is_archived)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={categoryId === c.id}
              className={pillCls(categoryId === c.id)}
              onClick={() => setValue('category', categoryId === c.id ? null : c.id)}
            >
              {c.name}
            </button>
          ))}
      </div>

      <div className={labelCls}>Forma de pagamento</div>
      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {pms?.results
          .filter((p) => !p.is_archived)
          .map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={pmId === p.id}
              className={pillCls(pmId === p.id)}
              onClick={() => setValue('payment_method', pmId === p.id ? null : p.id)}
            >
              {p.name}
            </button>
          ))}
      </div>

      {isCredit && pm?.card_detail && (
        <div className="mb-4 mt-1 rounded-xl border border-[rgba(91,143,199,.25)] bg-[rgba(91,143,199,.1)] px-3 py-2.5 text-[12.5px] text-[#cfe7d2]">
          Compra no crédito (fechamento dia {pm.card_detail.closing_day}) —{' '}
          <b>cai na fatura de {invoiceMonthLabel(pm.card_detail.closing_day, date)}</b>.
        </div>
      )}

      <label className="mb-3.5 flex items-center gap-2 text-sm text-[var(--mu)]">
        <input type="checkbox" {...register('is_paid')} /> Pago
      </label>

      {isCredit && !tx && (
        <>
          <div className={labelCls}>Parcelas</div>
          <div className="mb-3.5 flex flex-wrap gap-1.5">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={!custom && installments === n}
                className={pillCls(!custom && installments === n)}
                onClick={() => {
                  setCustom(false)
                  setValue('installments', n)
                }}
              >
                {n}×
              </button>
            ))}
            <button
              type="button"
              aria-pressed={custom}
              className={pillCls(custom)}
              onClick={() => setCustom(true)}
            >
              outro
            </button>
            {custom && (
              <input
                type="number"
                min={2}
                max={48}
                aria-label="Número de parcelas"
                className="w-20 rounded-xl border border-white/10 bg-black/25 px-3 py-2 outline-none"
                {...register('installments', { valueAsNumber: true })}
              />
            )}
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={create.isPending || update.isPending}
        className="btn solid mt-2.5 w-full justify-center"
      >
        Salvar lançamento
      </button>
      {tx && (
        <button
          type="button"
          onClick={() => setConfirmDel(true)}
          className="mt-2 w-full rounded-full border border-danger/30 py-2.5 text-sm text-danger"
        >
          Excluir
        </button>
      )}
      <ConfirmDialog
        open={confirmDel}
        title="Excluir lançamento"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => {
          setConfirmDel(false)
          void onDelete()
        }}
        onCancel={() => setConfirmDel(false)}
      />
    </form>
  )
}
