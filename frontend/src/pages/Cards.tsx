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
import type { Card, CardInvoice, PaginatedResponse } from '@/types/api'
import { Plus, Pencil, Trash2, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react'

const cardSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  color: z.string().min(1),
  closing_day: z.number().int().min(1).max(31),
  due_day: z.number().int().min(1).max(31),
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
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [deleteCardId, setDeleteCardId] = useState<number | null>(null)
  const [selectedColor, setSelectedColor] = useState('#818cf8')

  const { data: cards, isLoading } = useQuery<PaginatedResponse<Card>>({
    queryKey: ['cards'],
    queryFn: () => api.get<PaginatedResponse<Card>>('/cards/').then((r) => r.data),
  })

  const { data: invoices } = useQuery<PaginatedResponse<CardInvoice>>({
    queryKey: ['card-invoices', year, month],
    queryFn: () =>
      api
        .get<PaginatedResponse<CardInvoice>>('/cards/invoices/', { params: { year, month } })
        .then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: CardFormData) => api.post('/cards/', data),
    onSuccess: () => {
      toast('Cartão criado', 'success')
      queryClient.invalidateQueries({ queryKey: ['cards'] })
      setModalOpen(false)
      reset()
    },
    onError: () => toast('Erro ao criar cartão', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CardFormData }) =>
      api.patch(`/cards/${id}/`, data),
    onSuccess: () => {
      toast('Cartão atualizado', 'success')
      queryClient.invalidateQueries({ queryKey: ['cards'] })
      setModalOpen(false)
      setEditingCard(null)
      reset()
    },
    onError: () => toast('Erro ao atualizar cartão', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cards/${id}/`),
    onSuccess: () => {
      toast('Cartão removido', 'success')
      queryClient.invalidateQueries({ queryKey: ['cards'] })
      setDeleteCardId(null)
    },
    onError: () => toast('Erro ao remover', 'error'),
  })

  const markInvoicePaidMutation = useMutation({
    mutationFn: ({ id, is_paid }: { id: number; is_paid: boolean }) =>
      api.patch(`/cards/invoices/${id}/`, { is_paid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-invoices'] })
      toast('Fatura atualizada', 'success')
    },
    onError: () => toast('Erro ao atualizar fatura', 'error'),
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CardFormData>({
    resolver: zodResolver(cardSchema),
    defaultValues: { color: '#818cf8', closing_day: 3, due_day: 10 },
  })

  const openCreate = () => {
    setEditingCard(null)
    setSelectedColor('#818cf8')
    reset({ color: '#818cf8', closing_day: 3, due_day: 10 })
    setModalOpen(true)
  }

  const openEdit = (card: Card) => {
    setEditingCard(card)
    setSelectedColor(card.color)
    reset({ name: card.name, color: card.color, closing_day: card.closing_day, due_day: card.due_day })
    setModalOpen(true)
  }

  const onSubmit = (data: CardFormData) => {
    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data })
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
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : !cards?.results.length ? (
        <EmptyState
          icon={<CreditCard size={32} />}
          title="Nenhum cartão cadastrado"
          description="Adicione seus cartões para controlar faturas"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.results.map((card) => {
            const daysLeft = daysUntilDue(card.due_day)
            const invoice = invoices?.results.find((inv) => inv.card === card.id)
            const isWarning = daysLeft <= 5

            return (
              <div
                key={card.id}
                className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-5"
                style={{ borderLeftColor: card.color, borderLeftWidth: 3 }}
              >
                {/* Warning badge */}
                {isWarning && !invoice?.is_paid && (
                  <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
                    <AlertCircle size={12} />
                    Vence em {daysLeft} dia{daysLeft !== 1 ? 's' : ''}
                  </div>
                )}

                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                      style={{ backgroundColor: `${card.color}20`, color: card.color }}
                    >
                      {card.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">{card.name}</p>
                      <p className="text-xs text-text-muted">
                        Fecha dia {card.closing_day} · Vence dia {card.due_day}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(card)}
                      className="text-text-muted hover:text-info transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteCardId(card.id)}
                      className="text-text-muted hover:text-danger transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {invoice ? (
                  <div className="flex items-center justify-between rounded-xl bg-elevated p-3">
                    <div>
                      <p className="text-xs text-text-muted">Fatura</p>
                      <MoneyText value={invoice.amount} className="font-semibold text-text-primary" />
                    </div>
                    <button
                      onClick={() => markInvoicePaidMutation.mutate({ id: invoice.id, is_paid: !invoice.is_paid })}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
                      style={{
                        backgroundColor: invoice.is_paid ? '#34d39920' : '#94a3b820',
                        color: invoice.is_paid ? '#34d399' : '#94a3b8',
                      }}
                    >
                      {invoice.is_paid ? (
                        <>
                          <CheckCircle2 size={12} />
                          Paga
                        </>
                      ) : (
                        <>
                          <AlertCircle size={12} />
                          Pendente
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Sem fatura para este mês</p>
                )}
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
              {editingCard ? 'Editar Cartão' : 'Novo Cartão'}
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

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setEditingCard(null); reset() }}
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
