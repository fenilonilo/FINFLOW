import { useState } from 'react'
import { invoiceMonthLabel } from '@/lib/cardCycle'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usePeriod } from '@/contexts/PeriodContext'
import { api } from '@/api/client'
import MoneyText from '@/components/ui/MoneyText'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import CategoryBadge from '@/components/ui/CategoryBadge'
import { toast } from '@/components/ui/Toast'
import type { Transaction, Category, PaymentMethod, PaginatedResponse } from '@/types/models'
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Search,
  Pencil,
  Filter,
  ArrowLeftRight,
} from 'lucide-react'

const schema = z.object({
  type: z.enum(['income', 'expense']),
  fixed: z.boolean().default(false),
  description: z.string().min(1, 'Descrição obrigatória'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido'),
  date: z.string().min(1, 'Data obrigatória'),
  category: z.number().optional(),
  payment_method: z.number().optional(),
  is_paid: z.boolean().default(false),
  installments: z.number().int().min(2).max(48).optional(),
})

type FormData = z.infer<typeof schema>

export default function Transactions() {
  const { year, month } = usePeriod()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterCategory, setFilterCategory] = useState<number | null>(null)
  const [filterPayment, setFilterPayment] = useState<number | null>(null)
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const buildParams = () => {
    const params: Record<string, string> = { year: String(year), month: String(month), page: String(page) }
    if (filterType !== 'all') params.type = filterType
    if (filterCategory) params.category = String(filterCategory)
    if (filterPayment) params.payment_method = String(filterPayment)
    if (filterPaid === 'paid') params.is_paid = 'true'
    if (filterPaid === 'unpaid') params.is_paid = 'false'
    if (search) params.search = search
    return params
  }

  const { data, isLoading } = useQuery<PaginatedResponse<Transaction>>({
    queryKey: ['transactions', year, month, page, filterType, filterCategory, filterPayment, filterPaid, search],
    queryFn: () =>
      api.get<PaginatedResponse<Transaction>>('/transactions/', { params: buildParams() }).then((r) => r.data),
  })

  const { data: categories } = useQuery<PaginatedResponse<Category>>({
    queryKey: ['categories'],
    queryFn: () => api.get<PaginatedResponse<Category>>('/categories/').then((r) => r.data),
  })

  const { data: paymentMethods } = useQuery<PaginatedResponse<PaymentMethod>>({
    queryKey: ['payment-methods'],
    queryFn: () => api.get<PaginatedResponse<PaymentMethod>>('/payment-methods/').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: ({ fixed, ...data }: FormData) => {
      if (!fixed) return api.post('/transactions/', data)
      return api.post('/recurring-expenses/', {
        type: data.type,
        description: data.description,
        default_amount: data.amount,
        due_day: Number(data.date.slice(8, 10)),
        category: data.category,
        payment_method: data.payment_method,
        start_date: `${year}-${String(month).padStart(2, '0')}-01`,
      })
    },
    onSuccess: () => {
      toast('Lançamento criado', 'success')
      queryClient.invalidateQueries({ queryKey: ['summary', year, month] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setModalOpen(false)
      setIsInstallment(false)
      reset()
    },
    onError: () => toast('Erro ao criar lançamento', 'error'),
  })

  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const editMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: string }) =>
      api.patch(`/transactions/${id}/`, { amount }),
    onSuccess: () => {
      toast('Valor atualizado', 'success')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['summary', year, month] })
      setEditTx(null)
    },
    onError: () => toast('Erro ao atualizar', 'error'),
  })

  const togglePaidMutation = useMutation({
    mutationFn: ({ id, is_paid }: { id: number; is_paid: boolean }) =>
      api.patch(`/transactions/${id}/`, { is_paid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['summary', year, month] })
    },
    onError: () => toast('Erro ao atualizar', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/transactions/${id}/`),
    onSuccess: () => {
      toast('Lançamento removido', 'success')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['summary', year, month] })
      setDeleteId(null)
    },
    onError: () => toast('Erro ao remover', 'error'),
  })

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'expense', fixed: false, is_paid: false },
  })

  const txType = watch('type')
  const selectedPmId = watch('payment_method')
  const selectedPm = paymentMethods?.results.find((p) => p.id === selectedPmId)
  const isCredit = selectedPm?.card_function === 'credit'
  const watchedDate = watch('date')
  const [isInstallment, setIsInstallment] = useState(false)

  const onSubmit = (data: FormData) => {
    const payload: Record<string, unknown> = { ...data }
    if (!payload.category) delete payload.category
    if (!payload.payment_method) delete payload.payment_method
    if (!payload.installments || !isCredit || data.fixed) delete payload.installments
    createMutation.mutate(payload as FormData)
  }

  const PAGE_SIZE = 20
  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 1

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Lançamentos</h1>
        <button
          onClick={() => { reset(); setModalOpen(true) }}
          className="flex items-center gap-2 rounded-xl bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors"
        >
          <Plus size={16} />
          Novo Lançamento
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border-subtle bg-surface p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full rounded-xl border border-border-subtle bg-elevated py-2 pl-8 pr-3 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
            />
          </div>

          {/* Type filter */}
          <div className="flex rounded-xl border border-border-subtle bg-elevated overflow-hidden">
            {(['all', 'income', 'expense'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setFilterType(t); setPage(1) }}
                className={`px-3 py-2 text-xs transition-colors ${
                  filterType === t
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {t === 'all' ? 'Todos' : t === 'income' ? 'Entradas' : 'Saídas'}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <select
            value={filterCategory ?? ''}
            onChange={(e) => { setFilterCategory(e.target.value ? Number(e.target.value) : null); setPage(1) }}
            className="rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-muted focus:border-accent/50 focus:outline-none"
          >
            <option value="">Todas as categorias</option>
            {categories?.results.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Payment filter */}
          <select
            value={filterPayment ?? ''}
            onChange={(e) => { setFilterPayment(e.target.value ? Number(e.target.value) : null); setPage(1) }}
            className="rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-muted focus:border-accent/50 focus:outline-none"
          >
            <option value="">Todas as formas</option>
            {paymentMethods?.results.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.card_function === 'credit' ? ' · Crédito' : p.card_function === 'debit' ? ' · Débito' : ''}
              </option>
            ))}
          </select>

          {/* Paid filter */}
          <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-elevated overflow-hidden">
            {(['all', 'paid', 'unpaid'] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setFilterPaid(s); setPage(1) }}
                className={`px-3 py-2 text-xs transition-colors ${
                  filterPaid === s
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {s === 'all' ? 'Todos' : s === 'paid' ? 'Pagos' : 'Pendentes'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-xs text-text-muted">
            <Filter size={12} />
            {data?.count ?? 0} resultado{data?.count !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : !data?.results.length ? (
        <EmptyState
          icon={<ArrowLeftRight size={32} />}
          title="Nenhum lançamento encontrado"
          description="Adicione seu primeiro lançamento ou ajuste os filtros"
        />
      ) : (
        <div className="space-y-5">
          {([['income', 'Entradas'], ['expense', 'Saídas']] as const).map(([t, title]) => {
            const rows = data.results.filter((tx) => tx.type === t)
            if (!rows.length) return null
            return (
              <div key={t}>
                <h2 className="mb-2 text-sm font-semibold text-text-primary">{title}</h2>
        <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Descrição</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Categoria</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Forma</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">Pago</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((tx) => (
                <tr key={tx.id} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-text-muted tabular-nums">
                    {new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2 font-medium text-text-primary">
                        {tx.description}
                        {tx.is_fixed && (
                          <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">Fixo</span>
                        )}
                      </span>
                      {tx.installment_current && tx.installment_total && (
                        <span className="text-xs text-text-muted">
                          Parcela {tx.installment_current}/{tx.installment_total}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {tx.category_detail ? (
                      <CategoryBadge
                        name={tx.category_detail.name}
                        color={tx.category_detail.color}
                      />
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {tx.payment_method_detail?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MoneyText
                      value={tx.amount}
                      positive={tx.type === 'income'}
                      className="font-medium"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePaidMutation.mutate({ id: tx.id, is_paid: !tx.is_paid })}
                      className="transition-colors hover:opacity-80"
                      title={tx.is_paid ? 'Marcar como pendente' : 'Marcar como pago'}
                    >
                      {tx.is_paid ? (
                        <CheckCircle2 size={18} className="text-accent" />
                      ) : (
                        <Circle size={18} className="text-text-muted" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => { setEditTx(tx); setEditAmount(tx.amount) }}
                      className="mr-2 text-text-muted hover:text-accent transition-colors"
                      title="Editar valor"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteId(tx.id)}
                      className="text-text-muted hover:text-danger transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
                </div>
              </div>
            )
          })}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
              <span className="text-xs text-text-muted">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-border-subtle px-3 py-1 text-xs text-text-muted hover:bg-elevated disabled:opacity-40 transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-border-subtle px-3 py-1 text-xs text-text-muted hover:bg-elevated disabled:opacity-40 transition-colors"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: New Transaction */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl">
            <h2 className="mb-5 text-base font-semibold text-text-primary">Novo Lançamento</h2>

            {/* Tabs */}
            <div className="mb-5 flex rounded-xl border border-border-subtle bg-elevated overflow-hidden">
              {(['expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setValue('type', t); if (t === 'income') { setValue('is_paid', true) } }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    txType === t
                      ? t === 'expense'
                        ? 'bg-danger/20 text-danger'
                        : 'bg-accent/20 text-accent'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {t === 'expense' ? 'Saída' : 'Entrada'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">Descrição *</label>
                <input
                  {...register('description')}
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                  placeholder="Ex: Mercado, Salário..."
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-danger">{errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Valor (R$) *</label>
                  <input
                    {...register('amount')}
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                    placeholder="0.00"
                  />
                  {errors.amount && (
                    <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Data *</label>
                  <input
                    {...register('date')}
                    type="date"
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
                  />
                  {errors.date && (
                    <p className="mt-1 text-xs text-danger">{errors.date.message}</p>
                  )}
                </div>
              </div>

              {(
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">Categoria</label>
                    <select
                      {...register('category', { setValueAs: (v) => v === '' ? undefined : Number(v) })}
                      className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-muted focus:border-accent/50 focus:outline-none"
                    >
                      <option value="">Selecionar...</option>
                      {categories?.results.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">Forma de Pagamento</label>
                    <select
                      {...register('payment_method', { setValueAs: (v) => v === '' ? undefined : Number(v) })}
                      className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-muted focus:border-accent/50 focus:outline-none"
                    >
                      <option value="">Selecionar...</option>
                      {paymentMethods?.results.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.card_function === 'credit' ? ' · Crédito' : p.card_function === 'debit' ? ' · Débito' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {txType === 'expense' && isCredit && !watch('fixed') && (
                <div className="space-y-3 rounded-xl border border-accent/20 bg-accent/5 p-3">
                  {watchedDate && selectedPm?.card_detail && (
                    <p className="text-xs text-accent">
                      Entra na fatura de{' '}
                      {invoiceMonthLabel(selectedPm.card_detail.closing_day, watchedDate)}
                    </p>
                  )}
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isInstallment}
                      onChange={(e) => {
                        setIsInstallment(e.target.checked)
                        if (!e.target.checked) setValue('installments', undefined)
                      }}
                      className="h-4 w-4 rounded border-border-subtle accent-accent"
                    />
                    <span className="text-sm text-text-muted">Parcelado?</span>
                  </label>
                  {isInstallment && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-text-muted">
                        Nº de parcelas (valor total acima)
                      </label>
                      <input
                        {...register('installments', { valueAsNumber: true })}
                        type="number"
                        min={2}
                        max={48}
                        className="w-24 rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
                      />
                      {errors.installments && (
                        <p className="mt-1 text-xs text-danger">{errors.installments.message}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    {...register('fixed')}
                    type="checkbox"
                    className="h-4 w-4 rounded border-border-subtle accent-accent"
                  />
                  <span className="text-sm text-text-muted">Fixo (repete todo mês)</span>
                </label>

                {txType === 'expense' && (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      {...register('is_paid')}
                      type="checkbox"
                      className="h-4 w-4 rounded border-border-subtle accent-accent"
                    />
                    <span className="text-sm text-text-muted">Já foi pago</span>
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setIsInstallment(false); reset() }}
                  className="rounded-xl px-4 py-2 text-sm text-text-muted hover:bg-elevated transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-xl bg-accent/20 px-5 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit amount */}
      {editTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl">
            <h2 className="mb-1 text-base font-semibold text-text-primary">{editTx.description}</h2>
            <label className="mb-1.5 mt-4 block text-xs font-medium text-text-muted">Valor (R$)</label>
            <input
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
            />
            {editTx.is_fixed && (
              <p className="mt-2 text-xs text-warning">Vale para este mês e os seguintes.</p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setEditTx(null)} className="rounded-xl px-4 py-2 text-sm text-text-muted hover:bg-elevated transition-colors">
                Cancelar
              </button>
              <button
                disabled={!/^\d+(\.\d{1,2})?$/.test(editAmount) || editMutation.isPending}
                onClick={() => editMutation.mutate({ id: editTx.id, amount: editAmount })}
                className="rounded-xl bg-accent/20 px-5 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmDialog
        open={deleteId !== null}
        title="Remover lançamento"
        description="Esta ação não pode ser desfeita. O lançamento será removido permanentemente."
        confirmLabel="Remover"
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
