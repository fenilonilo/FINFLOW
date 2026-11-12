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
import BankCard from '@/components/ui/BankCard'
import CardSwap, { Card } from '@/components/ui/CardSwap'
import { toast } from '@/components/ui/Toast'
import { BANKS, BANK_KEYS } from '@/lib/banks'
import type { BankKey, CardSummary } from '@/types/models'
import { Plus, Pencil, Trash2, CreditCard, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

const cardSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  color: z.string().min(1),
  bank: z.enum(BANK_KEYS as [BankKey, ...BankKey[]]),
  is_active: z.boolean(),
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

const DEFAULTS: CardFormData = {
  name: '',
  color: '#818cf8',
  bank: 'other',
  is_active: true,
  closing_day: 3,
  due_day: 10,
  limit: '',
  functions: ['credit'],
}

function daysUntilDue(dueDay: number): number {
  const today = new Date()
  const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay)
  if (dueDate < today) {
    dueDate.setMonth(dueDate.getMonth() + 1)
  }
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function ActiveSwitch({
  checked,
  onChange,
  label = 'Ativo',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-accent bg-accent' : 'border-border-subtle bg-elevated'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
      {label}
    </div>
  )
}

function InvoicePanel({
  summary,
  onPay,
}: {
  summary: CardSummary
  onPay: (v: { cardId: number; is_paid: boolean }) => void
}) {
  const daysLeft = daysUntilDue(summary.due_day)
  const isWarning = daysLeft <= 5

  return (
    <>
      {isWarning && !summary.invoice.is_paid && (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          <AlertCircle size={12} />
          Vence em {daysLeft} dia{daysLeft !== 1 ? 's' : ''}
        </div>
      )}

      <p className="mb-3 text-xs text-text-muted">
        Fecha dia {summary.closing_day} · Vence dia {summary.due_day}
      </p>

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
      <div className="flex items-center justify-between gap-2 rounded-xl bg-elevated p-3">
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
          onClick={() => onPay({ cardId: summary.card_id, is_paid: !summary.invoice.is_paid })}
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
    </>
  )
}

export default function Cards() {
  const { year, month } = usePeriod()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCardId, setEditingCardId] = useState<number | null>(null)
  const [deleteCardId, setDeleteCardId] = useState<number | null>(null)
  const [selectedColor, setSelectedColor] = useState('#818cf8')
  const [activeIdx, setActiveIdx] = useState(0)

  const { data: summaries, isLoading } = useQuery<CardSummary[]>({
    queryKey: ['cards-summary', year, month],
    queryFn: () =>
      api
        .get<CardSummary[]>('/cards/summary/', { params: { year, month } })
        .then((r) => r.data),
  })

  // ativos primeiro; inativos esmaecidos no fim e fora da pilha
  const sorted = [...(summaries ?? [])].sort((a, b) => Number(b.is_active) - Number(a.is_active))
  const activeCards = sorted.filter((c) => c.is_active)
  const heroCard = activeCards[activeIdx] ?? activeCards[0]

  const invalidateCards = () => {
    queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
    queryClient.invalidateQueries({ queryKey: ['cards-summary'] })
    queryClient.invalidateQueries({ queryKey: ['cards'] })
  }

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/cards/${id}/`, { is_active }),
    onSuccess: invalidateCards,
    onError: () => toast('Erro ao alterar status do cartão', 'error'),
  })

  const createMutation = useMutation({
    mutationFn: (data: CardFormData) =>
      api.post('/cards/', { ...data, limit: data.limit || null }),
    onSuccess: () => {
      toast('Cartão criado', 'success')
      invalidateCards()
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
      invalidateCards()
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
      invalidateCards()
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

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CardFormData>({
    resolver: zodResolver(cardSchema),
    defaultValues: DEFAULTS,
  })

  const onBank = (bank: BankKey) => {
    setValue('bank', bank)
    if (bank === 'other') return
    if (!watch('name')) setValue('name', BANKS[bank].label)
    setValue('color', BANKS[bank].accent)
    setSelectedColor(BANKS[bank].accent)
  }

  const openCreate = () => {
    setEditingCardId(null)
    setSelectedColor(DEFAULTS.color)
    reset(DEFAULTS)
    setModalOpen(true)
  }

  const openEdit = (summary: CardSummary) => {
    setEditingCardId(summary.card_id)
    setSelectedColor(summary.color)
    reset({
      name: summary.name,
      color: summary.color,
      bank: summary.bank ?? 'other',
      is_active: summary.is_active ?? true,
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
    <div className="space-y-6 overflow-x-hidden">
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

      {/* Hero: pilha de cartões ativos + detalhes do cartão da frente */}
      {!isLoading && activeCards.length > 0 && (
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
          <div style={{ height: 420 }}>
            <CardSwap
              width={340}
              height={214}
              cardDistance={60}
              verticalDistance={70}
              depth={90}
              skewAmount={6}
              visibleCards={4}
              cardRadius={18}
              delay={4000}
              speed={1}
              bounce={0.35}
              parallax={0.5}
              hoverSpread={0.12}
              dim={0.5}
              autoplay
              pauseOnHover
              draggable
              theme="dark"
              onChange={setActiveIdx}
            >
              {activeCards.map((c) => (
                <Card key={c.card_id} className="!bg-transparent">
                  <BankCard
                    tilt={false}
                    bank={c.bank}
                    name={c.name}
                    color={c.color}
                    functions={c.functions}
                    dueDay={c.due_day}
                  />
                </Card>
              ))}
            </CardSwap>
          </div>
          {heroCard && (
            <div className="rounded-2xl border border-border-subtle bg-surface p-5">
              <p className="mb-1 font-semibold text-text-primary">{heroCard.name}</p>
              <InvoicePanel summary={heroCard} onPay={payInvoiceMutation.mutate} />
            </div>
          )}
        </div>
      )}

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
          {sorted.map((summary) => (
            <div
              key={summary.card_id}
              className={`relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-5 ${
                summary.is_active ? '' : 'opacity-60'
              }`}
              style={{ borderLeftColor: summary.color, borderLeftWidth: 3 }}
            >
              <BankCard
                static
                inactive={!summary.is_active}
                bank={summary.bank}
                name={summary.name}
                color={summary.color}
                functions={summary.functions}
                dueDay={summary.due_day}
                className="mx-auto mb-3 max-w-[240px]"
              />
              <div className="mb-3 flex items-center justify-between gap-2">
                <ActiveSwitch
                  checked={summary.is_active}
                  onChange={(v) => toggleMutation.mutate({ id: summary.card_id, is_active: v })}
                />
                <div className="flex gap-3">
                  <button
                    aria-label="Editar"
                    onClick={() => openEdit(summary)}
                    className="text-text-muted hover:text-info transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    aria-label="Remover"
                    onClick={() => setDeleteCardId(summary.card_id)}
                    className="text-text-muted hover:text-danger transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <InvoicePanel summary={summary} onPay={payInvoiceMutation.mutate} />
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl">
            <h2 className="mb-5 text-base font-semibold text-text-primary">
              {editingCardId !== null ? 'Editar Cartão' : 'Novo Cartão'}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <BankCard
                static
                bank={watch('bank')}
                name={watch('name')}
                color={selectedColor}
                functions={watch('functions')}
                dueDay={watch('due_day')}
                className="mx-auto max-w-[260px]"
              />

              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">Banco</label>
                <select
                  value={watch('bank')}
                  onChange={(e) => onBank(e.target.value as BankKey)}
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
                >
                  {BANK_KEYS.map((k) => (
                    <option key={k} value={k}>{BANKS[k].label}</option>
                  ))}
                </select>
              </div>

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

              <ActiveSwitch checked={watch('is_active')} onChange={(v) => setValue('is_active', v)} />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setEditingCardId(null); reset(DEFAULTS) }}
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
        description="O cartão e todas as faturas associadas serão removidas permanentemente."
        confirmLabel="Remover"
        onConfirm={() => deleteCardId !== null && deleteMutation.mutate(deleteCardId)}
        onCancel={() => setDeleteCardId(null)}
      />
    </div>
  )
}
