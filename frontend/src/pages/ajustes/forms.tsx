import { useState, type ReactNode } from 'react'
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  useArchiveCategory, useArchivePaymentMethod, useCategories, useCreateCategory, useCreatePaymentMethod,
  useCreateRecurring, usePaymentMethods, useUpdateCategory, useUpdatePaymentMethod, useUpdateRecurring,
} from '@/api/catalog'
import { useCreateCard, useUpdateCard } from '@/api/cards'
import ColorPicker from '@/components/ui/ColorPicker'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import IconPicker from '@/components/ui/IconPicker'
import { toast } from '@/components/ui/Toast'
import { parseMoney } from '@/lib/currency'
import { BANKS, BANK_KEYS } from '@/lib/banks'
import type { BankKey, CardSummary, Category, PaymentMethod, RecurringExpense } from '@/types/models'

const labelCls = 'mb-1.5 block text-xs font-medium text-[var(--mu)]'
const inputCls = 'w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 outline-none focus:border-[rgba(126,224,138,.45)]'
const errCls = 'mt-1 text-xs text-red-400'

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      {children}
      {error && <p className={errCls}>{error}</p>}
    </div>
  )
}

function Shell({ title, onSubmit, busy, archive, children }: { title: string; onSubmit: () => void; busy: boolean; archive?: { label: string; onConfirm: () => void }; children: ReactNode }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="eyebrow">{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '22px 0' }}>{children}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn solid" disabled={busy}>Salvar</button>
        {archive && <button type="button" className="btn line" onClick={() => setConfirm(true)}>{archive.label}</button>}
      </div>
      {archive && (
        <ConfirmDialog open={confirm} title={`${archive.label}?`} description="Os lançamentos existentes são mantidos." confirmLabel={archive.label} onConfirm={() => { setConfirm(false); archive.onConfirm() }} onCancel={() => setConfirm(false)} />
      )}
    </form>
  )
}

const optMoney = z.string().refine((v) => v === '' || /^[\d.,\sR$]*\d[\d.,\sR$]*$/.test(v), 'Valor inválido')

// mapeia o envelope {errors:{campo:[msg]}} para os campos do formulário
function fail<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, msg: string, known: string[]) {
  const errors = (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors ?? {}
  for (const [k, v] of Object.entries(errors)) if (known.includes(k) && v?.[0]) setError(k as Path<T>, { message: v[0] })
  toast(msg, 'error')
}
const dayField = z.number({ invalid_type_error: 'Dia inválido' }).int().min(1, 'Dia inválido').max(31, 'Dia inválido')

// ---------- categoria ----------
const catSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome'),
  icon: z.string().min(1),
  color: z.string().min(1),
  parent: z.number().nullable(),
  monthly_budget: optMoney,
})
type CatData = z.infer<typeof catSchema>

export function CategoryForm({ item, onDone }: { item?: Category; onDone: () => void }) {
  const cats = useCategories({ is_archived: false }).data?.results ?? []
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const archive = useArchiveCategory()
  const { register, handleSubmit, watch, setValue, setError, formState: { errors } } = useForm<CatData>({
    resolver: zodResolver(catSchema),
    defaultValues: { name: item?.name ?? '', icon: item?.icon ?? 'tag', color: item?.color ?? '#34d399', parent: item?.parent ?? null, monthly_budget: item?.monthly_budget ?? '' },
  })
  const save = handleSubmit(async (d) => {
    const payload = { ...d, monthly_budget: d.monthly_budget ? parseMoney(d.monthly_budget) : null }
    try {
      if (item) await update.mutateAsync({ id: item.id, ...payload })
      else await create.mutateAsync(payload)
      toast(item ? 'Categoria atualizada' : 'Categoria criada', 'success')
      onDone()
    } catch (e) { fail(e, setError, 'Erro ao salvar categoria', ['name', 'parent', 'monthly_budget']) }
  })
  return (
    <Shell
      title={item ? 'Editar categoria' : 'Nova categoria'}
      onSubmit={save}
      busy={create.isPending || update.isPending}
      archive={item && { label: 'Arquivar', onConfirm: () => archive.mutate(item.id, { onSuccess: () => { toast('Categoria arquivada', 'success'); onDone() }, onError: () => toast('Erro ao arquivar', 'error') }) }}
    >
      <Field id="c-name" label="Nome" error={errors.name?.message}><input id="c-name" className={inputCls} {...register('name')} /></Field>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span className={labelCls} style={{ margin: 0 }}>Ícone</span>
        <IconPicker value={watch('icon')} onChange={(v) => setValue('icon', v)} />
      </div>
      <div><span className={labelCls}>Cor</span><ColorPicker value={watch('color')} onChange={(v) => setValue('color', v)} /></div>
      <Field id="c-parent" label="Subcategoria de">
        <select id="c-parent" className={inputCls} {...register('parent', { setValueAs: (v) => (v ? Number(v) : null) })}>
          <option value="">Nenhuma</option>
          {cats.filter((c) => c.id !== item?.id && c.parent == null).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field id="c-budget" label="Orçamento mensal" error={errors.monthly_budget?.message}><input id="c-budget" inputMode="decimal" placeholder="0,00" className={inputCls} {...register('monthly_budget')} /></Field>
    </Shell>
  )
}

// ---------- forma de pagamento ----------
const pmSchema = z.object({ name: z.string().trim().min(1, 'Informe o nome'), icon: z.string().min(1), color: z.string().min(1) })
type PmData = z.infer<typeof pmSchema>

export function MethodForm({ item, onDone }: { item?: PaymentMethod; onDone: () => void }) {
  const create = useCreatePaymentMethod()
  const update = useUpdatePaymentMethod()
  const archive = useArchivePaymentMethod()
  const { register, handleSubmit, watch, setValue, setError, formState: { errors } } = useForm<PmData>({
    resolver: zodResolver(pmSchema),
    defaultValues: { name: item?.name ?? '', icon: item?.icon ?? 'wallet', color: item?.color ?? '#34d399' },
  })
  const save = handleSubmit(async (d) => {
    try {
      if (item) await update.mutateAsync({ id: item.id, ...d })
      else await create.mutateAsync(d)
      toast(item ? 'Forma atualizada' : 'Forma criada', 'success')
      onDone()
    } catch (e) { fail(e, setError, 'Erro ao salvar forma de pagamento', ['name']) }
  })
  return (
    <Shell
      title={item ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}
      onSubmit={save}
      busy={create.isPending || update.isPending}
      archive={item && { label: 'Arquivar', onConfirm: () => archive.mutate(item.id, { onSuccess: () => { toast('Forma arquivada', 'success'); onDone() }, onError: () => toast('Erro ao arquivar', 'error') }) }}
    >
      <Field id="p-name" label="Nome" error={errors.name?.message}><input id="p-name" className={inputCls} {...register('name')} /></Field>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span className={labelCls} style={{ margin: 0 }}>Ícone</span>
        <IconPicker value={watch('icon')} onChange={(v) => setValue('icon', v)} />
      </div>
      <div><span className={labelCls}>Cor</span><ColorPicker value={watch('color')} onChange={(v) => setValue('color', v)} /></div>
    </Shell>
  )
}

// ---------- cartão ----------
const cardSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome'),
  bank: z.enum(BANK_KEYS as [BankKey, ...BankKey[]]),
  color: z.string().min(1),
  closing_day: dayField,
  due_day: dayField,
  limit: optMoney,
  functions: z.array(z.enum(['credit', 'debit'])).min(1, 'Escolha ao menos uma função'),
})
type CardData = z.infer<typeof cardSchema>

export function CardForm({ item, onDone }: { item?: CardSummary; onDone: () => void }) {
  const create = useCreateCard()
  const update = useUpdateCard()
  const { register, handleSubmit, watch, setValue, getValues, setError, formState: { errors } } = useForm<CardData>({
    resolver: zodResolver(cardSchema),
    defaultValues: item
      ? { name: item.name, bank: item.bank ?? 'other', color: item.color, closing_day: item.closing_day, due_day: item.due_day, limit: item.limit ?? '', functions: item.functions }
      : { name: '', bank: 'other', color: BANKS.other.accent, closing_day: 3, due_day: 10, limit: '', functions: ['credit'] },
  })
  const fns = watch('functions')
  const save = handleSubmit(async (d) => {
    const payload = { ...d, limit: d.limit ? parseMoney(d.limit) : null }
    try {
      if (item) await update.mutateAsync({ id: item.card_id, ...payload })
      else await create.mutateAsync(payload)
      toast(item ? 'Cartão atualizado' : 'Cartão criado', 'success')
      onDone()
    } catch (e) { fail(e, setError, 'Erro ao salvar cartão', ['name', 'closing_day', 'due_day', 'limit', 'functions']) }
  })
  const num = { valueAsNumber: true } as const
  return (
    <Shell title={item ? 'Editar cartão' : 'Novo cartão'} onSubmit={save} busy={create.isPending || update.isPending}>
      <Field id="k-bank" label="Banco">
        <select
          id="k-bank" className={inputCls}
          {...register('bank', {
            onChange: (e) => {
              const b = e.target.value as BankKey
              if (b === 'other') return
              if (!getValues('name')) setValue('name', BANKS[b].label)
              setValue('color', BANKS[b].accent)
            },
          })}
        >
          {BANK_KEYS.map((k) => <option key={k} value={k}>{BANKS[k].label}</option>)}
        </select>
      </Field>
      <Field id="k-name" label="Nome" error={errors.name?.message}><input id="k-name" className={inputCls} {...register('name')} /></Field>
      <div style={{ display: 'flex', gap: 12 }}>
        <Field id="k-close" label="Fechamento (dia)" error={errors.closing_day?.message}><input id="k-close" type="number" className={inputCls} {...register('closing_day', num)} /></Field>
        <Field id="k-due" label="Vencimento (dia)" error={errors.due_day?.message}><input id="k-due" type="number" className={inputCls} {...register('due_day', num)} /></Field>
      </div>
      <Field id="k-limit" label="Limite" error={errors.limit?.message}><input id="k-limit" inputMode="decimal" placeholder="0,00" className={inputCls} {...register('limit')} /></Field>
      <div>
        <span className={labelCls}>Funções</span>
        <div style={{ display: 'flex', gap: 18, fontSize: 14 }}>
          {([['credit', 'Crédito'], ['debit', 'Débito']] as const).map(([f, l]) => (
            <label key={f} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={fns.includes(f)} onChange={(e) => setValue('functions', e.target.checked ? [...fns, f] : fns.filter((x) => x !== f), { shouldValidate: true })} />
              {l}
            </label>
          ))}
        </div>
        {errors.functions && <p className={errCls}>{errors.functions.message}</p>}
      </div>
      <div><span className={labelCls}>Cor</span><ColorPicker value={watch('color')} onChange={(v) => setValue('color', v)} /></div>
    </Shell>
  )
}

// ---------- fixo ----------
const fixSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição'),
  is_variable: z.boolean(),
  default_amount: optMoney,
  due_day: dayField,
  category: z.number().nullable(),
  payment_method: z.number().nullable(),
}).refine((d) => d.is_variable || d.default_amount !== '', { message: 'Informe o valor', path: ['default_amount'] })
type FixData = z.infer<typeof fixSchema>

export function FixoForm({ item, onDone }: { item?: RecurringExpense; onDone: () => void }) {
  const cats = useCategories({ is_archived: false }).data?.results ?? []
  const pms = (usePaymentMethods().data?.results ?? []).filter((p) => !p.is_archived)
  const create = useCreateRecurring()
  const update = useUpdateRecurring()
  const { register, handleSubmit, setError, formState: { errors } } = useForm<FixData>({
    resolver: zodResolver(fixSchema),
    defaultValues: { description: item?.description ?? '', is_variable: item?.is_variable ?? false, default_amount: item?.default_amount ?? '', due_day: item?.due_day ?? 1, category: item?.category ?? null, payment_method: item?.payment_method ?? null },
  })
  const save = handleSubmit(async (d) => {
    const payload = { ...d, default_amount: d.default_amount ? parseMoney(d.default_amount) : null }
    try {
      if (item) await update.mutateAsync({ id: item.id, ...payload })
      else await create.mutateAsync({ ...payload, type: 'expense', status: 'active' })
      toast(item ? 'Fixo atualizado' : 'Fixo criado', 'success')
      onDone()
    } catch (e) { fail(e, setError, 'Erro ao salvar fixo', ['description', 'default_amount', 'due_day']) }
  })
  const sel = { setValueAs: (v: string) => (v ? Number(v) : null) }
  return (
    <Shell title={item ? 'Editar fixo' : 'Novo fixo'} onSubmit={save} busy={create.isPending || update.isPending}>
      <Field id="f-desc" label="Descrição" error={errors.description?.message}><input id="f-desc" className={inputCls} {...register('description')} /></Field>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" {...register('is_variable')} />Valor variável (estimado)</label>
      <div style={{ display: 'flex', gap: 12 }}>
        <Field id="f-amt" label="Valor" error={errors.default_amount?.message}><input id="f-amt" inputMode="decimal" placeholder="0,00" className={inputCls} {...register('default_amount')} /></Field>
        <Field id="f-day" label="Dia" error={errors.due_day?.message}><input id="f-day" type="number" className={inputCls} {...register('due_day', { valueAsNumber: true })} /></Field>
      </div>
      <Field id="f-cat" label="Categoria">
        <select id="f-cat" className={inputCls} {...register('category', sel)}><option value="">Sem categoria</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </Field>
      <Field id="f-pm" label="Forma de pagamento">
        <select id="f-pm" className={inputCls} {...register('payment_method', sel)}><option value="">Sem forma</option>{pms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </Field>
    </Shell>
  )
}
