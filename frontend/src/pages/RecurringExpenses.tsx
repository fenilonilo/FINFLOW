import { useState } from 'react'
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
import type {
  RecurringExpense,
  Category,
  PaymentMethod,
  PaginatedResponse,
  PendingVariable,
  GenerateFixedResult,
} from '@/types/api'
import { Plus, Pencil, Archive, RefreshCw } from 'lucide-react'

const schema = z
  .object({
    description: z.string().min(1, 'Descrição obrigatória'),
    is_variable: z.boolean().default(false),
    default_amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido')
      .optional()
      .or(z.literal('')),
    due_day: z.number().int().min(1).max(31),
    category: z.number().optional(),
    payment_method: z.number().optional(),
    status: z.enum(['active', 'paused']).default('active'),
    total_occurrences: z.number().int().positive().optional(),
  })
  .refine((data) => data.is_variable || Boolean(data.default_amount), {
    message: 'Valor obrigatório para gastos fixos',
    path: ['default_amount'],
  })

type FormData = z.infer<typeof schema>

function VariableAmountsModal({
  items,
  onSubmit,
  onCancel,
  isPending,
}: {
  items: PendingVariable[]
  onSubmit: (data: Array<{ recurring_id: number; amount: string }>) => void
  onCancel: () => void
  isPending: boolean
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ overrides: Array<{ recurring_id: number; amount: string }> }>({
    defaultValues: {
      overrides: items.map((item) => ({
        recurring_id: item.id,
        amount: item.suggested_amount ?? '',
      })),
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl">
        <h2 className="mb-2 text-base font-semibold text-text-primary">
          Preencher valores variáveis
        </h2>
        <p className="mb-5 text-xs text-text-muted">
          Informe o valor real de cada gasto variável deste mês.
        </p>
        <form onSubmit={handleSubmit((d) => onSubmit(d.overrides))} className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-4">
              <input
                type="hidden"
                {...register(`overrides.${idx}.recurring_id`, { valueAsNumber: true })}
              />
              <span className="flex-1 text-sm text-text-primary">{item.description}</span>
              <div className="w-36">
                <input
                  {...register(`overrides.${idx}.amount`, {
                    required: 'Obrigatório',
                    pattern: { value: /^\d+(\.\d{1,2})?$/, message: 'Inválido' },
                  })}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-right text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                />
                {errors.overrides?.[idx]?.amount && (
                  <p className="mt-0.5 text-xs text-danger">
                    {errors.overrides[idx].amount?.message}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-4 py-2 text-sm text-text-muted hover:bg-elevated transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-accent/20 px-5 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function RecurringExpenses() {
  const { year, month } = usePeriod()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [archiveId, setArchiveId] = useState<number | null>(null)
  const [variableModalOpen, setVariableModalOpen] = useState(false)
  const [variablePending, setVariablePending] = useState<PendingVariable[]>([])

  const { data, isLoading } = useQuery<PaginatedResponse<RecurringExpense>>({
    queryKey: ['recurring-expenses'],
    queryFn: () =>
      api.get<PaginatedResponse<RecurringExpense>>('/recurring-expenses/').then((r) => r.data),
  })

  const { data: categories } = useQuery<PaginatedResponse<Category>>({
    queryKey: ['categories'],
    queryFn: () => api.get<PaginatedResponse<Category>>('/categories/').then((r) => r.data),
  })

  const { data: paymentMethods } = useQuery<PaginatedResponse<PaymentMethod>>({
    queryKey: ['payment-methods'],
    queryFn: () =>
      api.get<PaginatedResponse<PaymentMethod>>('/payment-methods/').then((r) => r.data),
  })

  const generateFixed = useMutation({
    mutationFn: () =>
      api
        .post<GenerateFixedResult>(`/months/${year}/${month}/generate-fixed/`)
        .then((r) => r.data),
    onSuccess: (result: GenerateFixedResult) => {
      queryClient.invalidateQueries({ queryKey: ['summary', year, month] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      if (result.pending_variables.length > 0) {
        setVariablePending(result.pending_variables)
        setVariableModalOpen(true)
        if (result.created > 0) {
          toast(`${result.created} lançamento(s) fixo(s) criado(s)`, 'success')
        }
      } else {
        toast(`${result.created} lançamento(s) criado(s)`, 'success')
      }
    },
    onError: () => toast('Erro ao gerar fixos', 'error'),
  })

  const generateVariables = useMutation({
    mutationFn: (overrides: Array<{ recurring_id: number; amount: string }>) =>
      api
        .post<{ created: number; skipped: number }>(
          `/months/${year}/${month}/generate-variables/`,
          overrides,
        )
        .then((r) => r.data),
    onSuccess: (result) => {
      toast(`${result.created} lançamento(s) variável(is) criado(s)`, 'success')
      setVariableModalOpen(false)
      setVariablePending([])
      queryClient.invalidateQueries({ queryKey: ['summary', year, month] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
    onError: () => toast('Erro ao gerar variáveis', 'error'),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<FormData>) => api.post('/recurring-expenses/', data),
    onSuccess: () => {
      toast('Gasto fixo criado', 'success')
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] })
      setModalOpen(false)
      reset()
    },
    onError: () => toast('Erro ao criar gasto fixo', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FormData> }) =>
      api.patch(`/recurring-expenses/${id}/`, data),
    onSuccess: () => {
      toast('Gasto fixo atualizado', 'success')
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] })
      setModalOpen(false)
      setEditingId(null)
      reset()
    },
    onError: () => toast('Erro ao atualizar', 'error'),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/recurring-expenses/${id}/`, { status: 'paused' }),
    onSuccess: () => {
      toast('Gasto fixo arquivado', 'success')
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] })
      setArchiveId(null)
    },
    onError: () => toast('Erro ao arquivar', 'error'),
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'active', due_day: 1, is_variable: false },
  })

  const isVariableWatched = watch('is_variable')

  const openEdit = (re: RecurringExpense) => {
    setEditingId(re.id)
    reset({
      description: re.description,
      is_variable: re.is_variable,
      default_amount: re.default_amount ?? '',
      due_day: re.due_day,
      category: re.category ?? undefined,
      payment_method: re.payment_method ?? undefined,
      status: re.status,
      total_occurrences: re.total_occurrences ?? undefined,
    })
    setModalOpen(true)
  }

  const onSubmit = (formData: FormData) => {
    const payload: Record<string, unknown> = { ...formData }
    if (!payload.category) delete payload.category
    if (!payload.payment_method) delete payload.payment_method
    if (!payload.total_occurrences) delete payload.total_occurrences
    if (!payload.default_amount) payload.default_amount = null
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload as Partial<FormData> })
    } else {
      createMutation.mutate(payload as Partial<FormData>)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Gastos Fixos</h1>
        <div className="flex gap-3">
          <button
            onClick={() => generateFixed.mutate()}
            disabled={generateFixed.isPending}
            className="flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 text-sm text-text-muted hover:bg-elevated transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={generateFixed.isPending ? 'animate-spin' : ''} />
            Gerar este mês
          </button>
          <button
            onClick={() => {
              reset({ status: 'active', due_day: 1, is_variable: false })
              setEditingId(null)
              setModalOpen(true)
            }}
            className="flex items-center gap-2 rounded-xl bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors"
          >
            <Plus size={16} />
            Novo Gasto Fixo
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : !data?.results.length ? (
        <EmptyState
          icon={<RefreshCw size={32} />}
          title="Nenhum gasto fixo"
          description="Configure seus gastos recorrentes mensais"
        />
      ) : (
        <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                  Descrição
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                  Categoria
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Forma</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">
                  Vencimento
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">
                  Ocorrências
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {data.results.map((re) => (
                <tr key={re.id} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">{re.description}</td>
                  <td className="px-4 py-3">
                    {re.category_detail ? (
                      <CategoryBadge
                        name={re.category_detail.name}
                        color={re.category_detail.color}
                      />
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {re.payment_method_detail?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {re.is_variable ? (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                        Variável
                      </span>
                    ) : re.default_amount ? (
                      <MoneyText value={re.default_amount} className="font-medium" />
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-text-muted">
                    Dia {re.due_day}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        re.status === 'active'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-text-muted/10 text-text-muted'
                      }`}
                    >
                      {re.status === 'active' ? 'Ativo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-text-muted">
                    {re.total_occurrences
                      ? `${re.generated_count}/${re.total_occurrences}`
                      : `${re.generated_count} gerado(s)`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(re)}
                        className="text-text-muted hover:text-info transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      {re.status === 'active' && (
                        <button
                          onClick={() => setArchiveId(re.id)}
                          className="text-text-muted hover:text-warning transition-colors"
                        >
                          <Archive size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl">
            <h2 className="mb-5 text-base font-semibold text-text-primary">
              {editingId ? 'Editar Gasto Fixo' : 'Novo Gasto Fixo'}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Descrição *
                </label>
                <input
                  {...register('description')}
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-danger">{errors.description.message}</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_variable"
                  {...register('is_variable')}
                  className="h-4 w-4 rounded border-border-subtle accent-accent"
                />
                <label htmlFor="is_variable" className="text-xs font-medium text-text-muted">
                  Valor variável (ex: luz, telefone)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    {isVariableWatched ? 'Valor Sugerido (opcional)' : 'Valor (R$) *'}
                  </label>
                  <input
                    {...register('default_amount')}
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                  />
                  {errors.default_amount && (
                    <p className="mt-1 text-xs text-danger">{errors.default_amount.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    Dia de Vencimento *
                  </label>
                  <input
                    {...register('due_day', { valueAsNumber: true })}
                    type="number"
                    min={1}
                    max={31}
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
                  />
                  {errors.due_day && (
                    <p className="mt-1 text-xs text-danger">{errors.due_day.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    Categoria
                  </label>
                  <select
                    {...register('category', {
                      setValueAs: (v) => (v === '' ? undefined : Number(v)),
                    })}
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-muted focus:border-accent/50 focus:outline-none"
                  >
                    <option value="">Selecionar...</option>
                    {categories?.results.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    Forma de Pagamento
                  </label>
                  <select
                    {...register('payment_method', {
                      setValueAs: (v) => (v === '' ? undefined : Number(v)),
                    })}
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-muted focus:border-accent/50 focus:outline-none"
                  >
                    <option value="">Selecionar...</option>
                    {paymentMethods?.results.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    Status
                  </label>
                  <select
                    {...register('status')}
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-muted focus:border-accent/50 focus:outline-none"
                  >
                    <option value="active">Ativo</option>
                    <option value="paused">Pausado</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    Total de Ocorrências
                  </label>
                  <input
                    {...register('total_occurrences', {
                      setValueAs: (v) => (v === '' ? undefined : Number(v)),
                    })}
                    type="number"
                    min={1}
                    placeholder="Ilimitado"
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false)
                    setEditingId(null)
                    reset()
                  }}
                  className="rounded-xl px-4 py-2 text-sm text-text-muted hover:bg-elevated transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-xl bg-accent/20 px-5 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Variable Amounts Modal */}
      {variableModalOpen && (
        <VariableAmountsModal
          items={variablePending}
          onSubmit={(overrides) => generateVariables.mutate(overrides)}
          onCancel={() => {
            setVariableModalOpen(false)
            setVariablePending([])
          }}
          isPending={generateVariables.isPending}
        />
      )}

      <ConfirmDialog
        open={archiveId !== null}
        title="Arquivar gasto fixo"
        description="O gasto fixo será pausado e não gerará mais lançamentos automaticamente."
        confirmLabel="Arquivar"
        onConfirm={() => archiveId !== null && archiveMutation.mutate(archiveId)}
        onCancel={() => setArchiveId(null)}
      />
    </div>
  )
}
