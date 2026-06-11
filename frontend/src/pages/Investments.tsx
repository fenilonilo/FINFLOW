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
import { toast } from '@/components/ui/Toast'
import type { Investment, PaginatedResponse } from '@/types/api'
import { Plus, Trash2, TrendingUp } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const schema = z.object({
  date: z.string().min(1, 'Data obrigatória'),
  location: z.string().min(1, 'Local obrigatório'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido'),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
})

type FormData = z.infer<typeof schema>

export default function Investments() {
  const { year, month } = usePeriod()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<PaginatedResponse<Investment>>({
    queryKey: ['investments', year, month],
    queryFn: () =>
      api
        .get<PaginatedResponse<Investment>>('/investments/', {
          params: { year, month },
        })
        .then((r) => r.data),
  })

  const { data: allInvestments } = useQuery<PaginatedResponse<Investment>>({
    queryKey: ['investments-all'],
    queryFn: () =>
      api.get<PaginatedResponse<Investment>>('/investments/').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post('/investments/', data),
    onSuccess: () => {
      toast('Aporte registrado', 'success')
      queryClient.invalidateQueries({ queryKey: ['investments'] })
      queryClient.invalidateQueries({ queryKey: ['investments-all'] })
      queryClient.invalidateQueries({ queryKey: ['summary', year, month] })
      setModalOpen(false)
      reset()
    },
    onError: () => toast('Erro ao registrar aporte', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/investments/${id}/`),
    onSuccess: () => {
      toast('Aporte removido', 'success')
      queryClient.invalidateQueries({ queryKey: ['investments'] })
      queryClient.invalidateQueries({ queryKey: ['investments-all'] })
      setDeleteId(null)
    },
    onError: () => toast('Erro ao remover', 'error'),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { year, month },
  })

  // Build cumulative chart data grouped by month
  const chartData = (() => {
    if (!allInvestments?.results.length) return []
    const grouped: Record<string, number> = {}
    allInvestments.results.forEach((inv) => {
      const key = `${MONTH_NAMES[inv.month - 1]}/${inv.year}`
      grouped[key] = (grouped[key] ?? 0) + parseFloat(inv.amount)
    })
    let cumulative = 0
    return Object.entries(grouped).map(([period, amount]) => {
      cumulative += amount
      return { period, aporte: amount, acumulado: cumulative }
    })
  })()

  const totalThisMonth = data?.results.reduce((sum, inv) => sum + parseFloat(inv.amount), 0) ?? 0

  const onSubmit = (formData: FormData) => createMutation.mutate(formData)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Investimentos</h1>
          <p className="text-xs text-text-muted">
            {MONTH_NAMES[month - 1]}/{year} — Total:{' '}
            <MoneyText value={String(totalThisMonth)} className="text-accent font-medium" />
          </p>
        </div>
        <button
          onClick={() => { reset({ year, month }); setModalOpen(true) }}
          className="flex items-center gap-2 rounded-xl bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors"
        >
          <Plus size={16} />
          Novo Aporte
        </button>
      </div>

      {/* Cumulative Area Chart */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-border-subtle bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Evolução do Patrimônio</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243044" />
              <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={70} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  border: '1px solid #243044',
                  borderRadius: '12px',
                }}
                labelStyle={{ color: '#f1f5f9' }}
                formatter={(value: number) =>
                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
                }
              />
              <Area
                type="monotone"
                dataKey="acumulado"
                stroke="#34d399"
                fill="#34d399"
                fillOpacity={0.2}
                strokeWidth={2}
                name="Acumulado"
              />
              <Area
                type="monotone"
                dataKey="aporte"
                stroke="#fbbf24"
                fill="#fbbf24"
                fillOpacity={0.15}
                strokeWidth={2}
                name="Aporte no Mês"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Contributions table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : !data?.results.length ? (
        <EmptyState
          icon={<TrendingUp size={32} />}
          title="Nenhum aporte registrado"
          description="Registre seus investimentos clicando em Novo Aporte"
        />
      ) : (
        <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Local/Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {data.results.map((inv) => (
                <tr key={inv.id} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-text-muted tabular-nums">
                    {new Date(inv.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">{inv.location}</td>
                  <td className="px-4 py-3 text-right">
                    <MoneyText value={inv.amount} positive className="font-semibold" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setDeleteId(inv.id)}
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
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl">
            <h2 className="mb-5 text-base font-semibold text-text-primary">Novo Aporte</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Data *</label>
                  <input
                    {...register('date')}
                    type="date"
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
                  />
                  {errors.date && <p className="mt-1 text-xs text-danger">{errors.date.message}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Valor (R$) *</label>
                  <input
                    {...register('amount')}
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                  />
                  {errors.amount && <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">Local / Tipo *</label>
                <input
                  {...register('location')}
                  placeholder="Ex: Tesouro Direto, Nubank, XP..."
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                />
                {errors.location && <p className="mt-1 text-xs text-danger">{errors.location.message}</p>}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); reset() }}
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

      <ConfirmDialog
        open={deleteId !== null}
        title="Remover aporte"
        description="Este aporte será removido permanentemente."
        confirmLabel="Remover"
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
