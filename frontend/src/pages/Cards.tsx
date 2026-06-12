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
import ColorPicker from '@/components/ui/ColorPicker'
import { toast } from '@/components/ui/Toast'
import type { CardSummary } from '@/types/api'
import { Plus, Pencil, Trash2, CreditCard, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

const cardSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  color: z.string().min(1),
  closing_day: z.number().int().min(1).max(31),
  due_day: z.number().int().min(1).max(31),
  limit: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido')
    .optional()
    .or(z.literal('')),
  functions: z
    .array(z.enum(['credit', 'debit']))
    .min(1, 'Escolha ao menos uma função'),
})

type CardFormData = z.infer<typeof cardSchema>

function daysUntilDue(dueDay: number): number {
  const today = new Date()
  const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay)
  if (dueDate < today) {
    dueDate.setMonth(dueDate.getMonth() + 1)
  }
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function Cards() {
  const { year, month } = usePeriod()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCardId, setEditingCardId] = useState<number | null>(null)
  const [deleteCardId, setDeleteCardId] = useState<number | null>(null)
  const [selectedColor, setSelectedColor] = useState('#818cf8')

  const { data: summaries, isLoading } = useQuery<CardSummary[]>({
    queryKey: ['cards-summary', year, month],
    queryFn: () =>
      api
        .get<CardSummary[]>('/cards/summary/', { params: { year, month } })
        .then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: CardFormData) =>
      api.post('/cards/', { ...data, limit: data.limit || null }),
    onSuccess: () => {
      toast('Cartão criado', 'success')
      queryClient.invalidateQueries({ queryKey: ['cards-summary'] })
      setModalOpen(false)
      reset()
    },
    onError: () => toast('Erro ao criar cartão', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CardFormData }) =>
      api.patch(`/cards/${id}/`, { ...data, limit: data.limit || null }),
    onSuccess: () => {
      toast('Cartão atualizado', 'success')
      queryClient.invalidateQueries({ queryKey: ['cards-summary'] })
      setModalOpen(false)
      setEditingCardId(null)
      reset()
    },
    onError: () => toast('Erro ao atualizar cartão', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cards/${id}/`),
    onSuccess: () => {
      toast('Cartão removido', 'success')
      queryClient.invalidateQueries({ queryKey: ['cards-summary'] })
      setDeleteCardId(null)
    },
    onError: () => toast('Erro ao remover', 'error'),
  })

  const payInvoiceMutation = useMutation({
    mutationFn: ({ cardId, is_paid }: { cardId: number; is_paid: boolean }) =>
      api.post(`/cards/${cardId}/pay-invoice/`, { year, month, is_paid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards-summary'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      toast('Fatura atualizada', 'success')
    },
    onError: () => toast('Erro ao atualizar fatura', 'error'),
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CardFormData>({
    resolver: zodResolver(cardSchema),
    defaultValues: { color: '#818cf8', closing_day: 3, due_day: 10, limit: '', functions: ['credit'] },
  })

  const openCreate = () => {
    setEditingCardId(null)
    setSelectedColor('#818cf8')
    reset({ color: '#818cf8', closing_day: 3, due_day: 10, limit: '', functions: ['credit'] })
    setModalOpen(true)
  }

  const openEdit = (summary: CardSummary) => {
    setEditingCardId(summary.card_id)
    setSelectedColor(summary.color)
    reset({
      name: summary.name,
      color: summary.color,
      closing_day: summary.closing_day,
      due_day: summary.due_day,
      limit: summary.limit ?? '',
      functions: summary.functions,
    })
    setModalOpen(true)
  }

  const onSubmit = (data: CardFormData) => {
    if (editingCardId !== null) {
      updateMutation.mutate({ id: editingCardId, data })
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Cartões</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors"
        >
          <Plus size={16} />
          Novo Cartão
        </button>
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : !summaries?.length ? (
        <EmptyState
          icon={<CreditCard size={32} />}
          title="Nenhum cartão cadastrado"
          description="Adicione seus cartões para controlar faturas"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {summaries.map((summary) => {
            const daysLeft = daysUntilDue(summary.due_day)
            const isWarning = daysLeft <= 5

            return (
              <div
                key={summary.card_id}
                className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-5"
                style={{ borderLeftColor: summary.color, borderLeftWidth: 3 }}
              >
                {/* Warning badge */}
                {isWarning && !summary.invoice.is_paid && (
                  <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
                    <AlertCircle size={12} />
                    Vence em {daysLeft} dia{daysLeft !== 1 ? 's' : ''}
                  </div>
                )}

                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                      style={{ backgroundColor: `${summary.color}20`, color: summary.color }}
                    >
                      {summary.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">{summary.name}</p>
                      <p className="text-xs text-text-muted">
                        Fecha dia {summary.closing_day} · Vence dia {summary.due_day}
                      </p>
                      {summary.functions.length > 0 && (
                        <p className="text-xs text-text-muted capitalize">
                          {summary.functions.map((f) => (f === 'credit' ? 'Crédito' : 'Débito')).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(summary)}
                      className="text-text-muted hover:text-info transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteCardId(summary.card_id)}
                      className="text-text-muted hover:text-danger transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Barra de limite */}
                {summary.limit && (
                  <div className="mb-3">
                    <div className="mb-1 flex justify-between text-xs text-text-muted">
                      <span>Comprometido</span>
                      <span>
                        <MoneyText value={summary.committed} /> / <MoneyText value={summary.limit} />
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-elevated">
                      <div
                        className={`h-full rounded-full transition-all ${
                          Number(summary.committed_pct) >= 90
                            ? 'bg-danger'
                            : Number(summary.committed_pct) >= 70
                              ? 'bg-warning'
                              : 'bg-accent'
                        }`}
                        style={{ width: `${Math.min(100, Number(summary.committed_pct ?? 0))}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Fatura do mês */}
                <div className="flex items-center justify-between rounded-xl bg-elevated p-3">
                  <div>
                    <p className="text-xs text-text-muted">
                      Fatura · {new Date(summary.invoice.cycle_start + 'T12:00:00').toLocaleDateString('pt-BR')}
                      {' – '}
                      {new Date(summary.invoice.cycle_end + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                    <MoneyText
                      value={
                        summary.invoice.is_paid && summary.invoice.snapshot_amount
                          ? summary.invoice.snapshot_amount
                          : summary.invoice.amount
                      }
                      className="font-semibold text-text-primary"
                    />
                    {summary.invoice.divergent && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-lg bg-warning/10 px-2 py-0.5 text-xs text-warning">
                        <AlertTriangle size={11} />
                        valor divergente
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      payInvoiceMutation.mutate({
                        cardId: summary.card_id,
                        is_paid: !summary.invoice.is_paid,
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
                    style={{
                      backgroundColor: summary.invoice.is_paid ? '#34d39920' : '#94a3b820',
                      color: summary.invoice.is_paid ? '#34d399' : '#94a3b8',
                    }}
                  >
                    {summary.invoice.is_paid ? (
                      <><CheckCircle2 size={12} /> Paga</>
                    ) : (
                      <><AlertCircle size={12} /> Pendente</>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl">
            <h2 className="mb-5 text-base font-semibold text-text-primary">
              {editingCardId !== null ? 'Editar Cartão' : 'Novo Cartão'}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">Nome *</label>
                <input
                  {...register('name')}
                  placeholder="Ex: Nubank, XP, Itaú..."
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                />
                {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-text-muted">Cor</label>
                <ColorPicker
                  value={selectedColor}
                  onChange={(c) => { setSelectedColor(c); setValue('color', c) }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Dia de Fechamento</label>
                  <input
                    {...register('closing_day', { valueAsNumber: true })}
                    type="number"
                    min={1}
                    max={31}
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Dia de Vencimento</label>
                  <input
                    {...register('due_day', { valueAsNumber: true })}
                    type="number"
                    min={1}
                    max={31}
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Limite */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Limite (R$, opcional)
                </label>
                <input
                  {...register('limit')}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                />
                {errors.limit && <p className="mt-1 text-xs text-danger">{errors.limit.message}</p>}
              </div>

              {/* Funções */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">Funções</label>
                <div className="flex gap-4">
                  {(['credit', 'debit'] as const).map((fn) => (
                    <label key={fn} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        value={fn}
                        {...register('functions')}
                        className="h-4 w-4 rounded border-border-subtle accent-accent"
                      />
                      <span className="text-sm text-text-muted">
                        {fn === 'credit' ? 'Crédito' : 'Débito'}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.functions && (
                  <p className="mt-1 text-xs text-danger">{errors.functions.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setEditingCardId(null); reset() }}
                  className="rounded-xl px-4 py-2 text-sm text-text-muted hover:bg-elevated transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-xl bg-accent/20 px-5 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteCardId !== null}
        title="Remover cartão"
        description="O cartão e todas as faturas associadas serão removidos permanentemente."
        confirmLabel="Remover"
        onConfirm={() => deleteCardId !== null && deleteMutation.mutate(deleteCardId)}
        onCancel={() => setDeleteCardId(null)}
      />
    </div>
  )
}
