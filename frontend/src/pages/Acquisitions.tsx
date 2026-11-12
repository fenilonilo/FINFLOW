import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/api/client'
import MoneyText from '@/components/ui/MoneyText'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { toast } from '@/components/ui/Toast'
import type { SimulationResult, PaginatedResponse } from '@/types/models'
import {
  ShoppingBag,
  Play,
  Save,
  ChevronRight,
  TrendingDown,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
  Legend,
} from 'recharts'

const ACQUISITION_TYPES = [
  { value: 'cash', label: 'À vista', icon: '💵', description: 'Pagamento único' },
  { value: 'installment', label: 'Parcelado', icon: '📅', description: 'Sem juros' },
  { value: 'financing', label: 'Financiamento', icon: '🏦', description: 'Com juros' },
  { value: 'consortium', label: 'Consórcio', icon: '🤝', description: 'Grupo de compra' },
]

const VERDICT_CONFIG = {
  safe: { label: 'Seguro', color: 'text-accent', bg: 'bg-accent/10 border-accent/30' },
  moderate: { label: 'Moderado', color: 'text-warning', bg: 'bg-warning/10 border-warning/30' },
  risky: { label: 'Arriscado', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/30' },
  critical: { label: 'Crítico', color: 'text-danger', bg: 'bg-danger/10 border-danger/30' },
}

const simulatorSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  total_value: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido'),
  acquisition_type: z.enum(['cash', 'installment', 'financing', 'consortium']),
  down_payment: z.string().optional(),
  installments: z.number().int().min(1).max(120).default(1),
  monthly_interest_rate: z.string().optional(),
  amortization_system: z.enum(['price', 'sac']).optional(),
  extra_monthly_cost: z.string().optional(),
  start_date: z.string().optional(),
})

type SimulatorFormData = z.infer<typeof simulatorSchema>

interface AcquisitionItem {
  id: number
  name: string
  acquisition_type: string
  total_value: string
  installment_current: number
  installment_total: number
  installment_amount: string
  is_active: boolean
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const pct = score / 100
  const halfCirc = Math.PI * 40
  const color =
    score >= 80 ? '#34d399' : score >= 60 ? '#60a5fa' : score >= 40 ? '#fbbf24' : '#f87171'
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="60" viewBox="0 0 100 60">
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="#243044"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={halfCirc}
          strokeDashoffset={halfCirc * (1 - pct)}
        />
        <text x="50" y="48" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>
          {score}
        </text>
      </svg>
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  )
}

export default function Acquisitions() {
  const queryClient = useQueryClient()
  const [simulation, setSimulation] = useState<SimulationResult | null>(null)
  const [activateOpen, setActivateOpen] = useState(false)
  const [cancelId, setCancelId] = useState<number | null>(null)

  const { data: acquisitions, isLoading: acqLoading } = useQuery<PaginatedResponse<AcquisitionItem>>({
    queryKey: ['acquisitions'],
    queryFn: () =>
      api.get<PaginatedResponse<AcquisitionItem>>('/acquisitions/').then((r) => r.data),
  })

  const simulateMutation = useMutation({
    mutationFn: (data: SimulatorFormData) =>
      api.post<SimulationResult>('/acquisitions/simulate/', data).then((r) => r.data),
    onSuccess: (result) => {
      setSimulation(result)
      toast('Simulação concluída', 'success')
    },
    onError: () => toast('Erro ao simular', 'error'),
  })

  const saveMutation = useMutation({
    mutationFn: (data: SimulatorFormData) => api.post('/acquisitions/', { ...data, simulation }),
    onSuccess: () => {
      toast('Simulação salva', 'success')
      queryClient.invalidateQueries({ queryKey: ['acquisitions'] })
    },
    onError: () => toast('Erro ao salvar', 'error'),
  })

  const activateMutation = useMutation({
    mutationFn: (data: SimulatorFormData) =>
      api.post('/acquisitions/', { ...data, simulation, activate: true }),
    onSuccess: () => {
      toast('Aquisição ativada — gasto fixo criado', 'success')
      queryClient.invalidateQueries({ queryKey: ['acquisitions'] })
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] })
      setActivateOpen(false)
    },
    onError: () => toast('Erro ao ativar', 'error'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/acquisitions/${id}/`),
    onSuccess: () => {
      toast('Aquisição cancelada', 'success')
      queryClient.invalidateQueries({ queryKey: ['acquisitions'] })
      setCancelId(null)
    },
    onError: () => toast('Erro ao cancelar', 'error'),
  })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SimulatorFormData>({
    resolver: zodResolver(simulatorSchema),
    defaultValues: {
      acquisition_type: 'installment',
      installments: 12,
    },
  })

  const acqType = watch('acquisition_type')
  const installments = watch('installments')
  const formValues = watch()

  const needsInterest = acqType === 'financing' || acqType === 'consortium'

  const onSimulate = (data: SimulatorFormData) => {
    const payload: Record<string, unknown> = { ...data }
    if (!payload.down_payment || payload.down_payment === '') delete payload.down_payment
    if (!payload.extra_monthly_cost || payload.extra_monthly_cost === '') delete payload.extra_monthly_cost
    if (!payload.start_date || payload.start_date === '') delete payload.start_date
    if (!needsInterest) {
      delete payload.monthly_interest_rate
      delete payload.amortization_system
    }
    simulateMutation.mutate(payload as SimulatorFormData)
  }

  const timelineData = simulation?.impact.timeline.map((t) => ({
    period: `${t.month}/${t.year}`,
    saldo: parseFloat(t.projected_balance),
    pago: parseFloat(t.cumulative_paid),
  })) ?? []

  const scheduleData = simulation?.schedule.map((s) => ({
    parcela: s.number,
    Juros: parseFloat(s.interest_portion),
    Amortização: parseFloat(s.principal_portion),
  })) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Aquisições</h1>
      </div>

      {/* Simulator */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Form */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-5">
          <h2 className="mb-5 text-sm font-semibold text-text-primary">Simulador</h2>
          <form onSubmit={handleSubmit(onSimulate)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Nome da Aquisição *</label>
              <input
                {...register('name')}
                placeholder="Ex: Notebook Dell, Carro, Imóvel..."
                className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
              />
              {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Valor Total (R$) *</label>
              <input
                {...register('total_value')}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
              />
              {errors.total_value && <p className="mt-1 text-xs text-danger">{errors.total_value.message}</p>}
            </div>

            {/* Type Cards */}
            <div>
              <label className="mb-2 block text-xs font-medium text-text-muted">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                {ACQUISITION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setValue('acquisition_type', t.value as SimulatorFormData['acquisition_type'])}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      acqType === t.value
                        ? 'border-accent/50 bg-accent/10'
                        : 'border-border-subtle bg-elevated hover:border-border-subtle/70'
                    }`}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <span className={`text-xs font-medium ${acqType === t.value ? 'text-accent' : 'text-text-primary'}`}>
                      {t.label}
                    </span>
                    <span className="text-xs text-text-muted">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Down payment */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">Entrada (R$)</label>
                <input
                  {...register('down_payment')}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                />
              </div>

              {acqType !== 'cash' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    Parcelas: {installments}
                  </label>
                  <input
                    {...register('installments', { valueAsNumber: true })}
                    type="range"
                    min={1}
                    max={120}
                    step={1}
                    className="w-full accent-accent"
                  />
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>1</span>
                    <span>120</span>
                  </div>
                </div>
              )}
            </div>

            {/* Interest — financing/consortium only */}
            {needsInterest && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Juros % a.m.</label>
                  <input
                    {...register('monthly_interest_rate')}
                    type="text"
                    inputMode="decimal"
                    placeholder="1.99"
                    className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                  />
                </div>

                {acqType === 'financing' && (
                  <div>
                    <label className="mb-2 block text-xs font-medium text-text-muted">Sistema de Amortização</label>
                    <div className="flex gap-3">
                      {(['price', 'sac'] as const).map((s) => (
                        <label key={s} className="flex cursor-pointer items-center gap-2">
                          <input
                            {...register('amortization_system')}
                            type="radio"
                            value={s}
                            className="accent-accent"
                          />
                          <span className="text-sm text-text-muted uppercase">{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">Custo Mensal Extra</label>
                <input
                  {...register('extra_monthly_cost')}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">Data Início</label>
                <input
                  {...register('start_date')}
                  type="date"
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={simulateMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent/20 py-3 text-sm font-medium text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
            >
              {simulateMutation.isPending ? (
                <span className="animate-spin">⟳</span>
              ) : (
                <ChevronRight size={16} />
              )}
              {simulateMutation.isPending ? 'Simulando...' : 'Simular'}
            </button>
          </form>
        </div>

        {/* Right: Result */}
        <div className="space-y-4">
          {simulateMutation.isPending ? (
            <>
              <Skeleton className="h-48" />
              <Skeleton className="h-64" />
            </>
          ) : simulation ? (
            <>
              {/* Summary Card */}
              <div className="rounded-2xl border border-border-subtle bg-surface p-5">
                <h3 className="mb-4 text-sm font-semibold text-text-primary">Resultado da Simulação</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl bg-elevated p-3">
                    <p className="text-xs text-text-muted">1ª Parcela</p>
                    <MoneyText value={simulation.monthly_payment_first} className="font-semibold text-text-primary" />
                  </div>
                  {simulation.monthly_payment_first !== simulation.monthly_payment_last && (
                    <div className="rounded-xl bg-elevated p-3">
                      <p className="text-xs text-text-muted">Última Parcela</p>
                      <MoneyText value={simulation.monthly_payment_last} className="font-semibold text-text-primary" />
                    </div>
                  )}
                  <div className="rounded-xl bg-elevated p-3">
                    <p className="text-xs text-text-muted">Total Pago</p>
                    <MoneyText value={simulation.total_paid} className="font-semibold text-danger" />
                  </div>
                  <div className="rounded-xl bg-elevated p-3">
                    <p className="text-xs text-text-muted">Total Juros</p>
                    <MoneyText value={simulation.total_interest} className="font-semibold text-warning" />
                  </div>
                  <div className="rounded-xl bg-elevated p-3 col-span-2">
                    <p className="text-xs text-text-muted">Custo Efetivo</p>
                    <p className="font-semibold text-info">{simulation.effective_cost_pct}% a.a.</p>
                  </div>
                </div>

                {/* Score Comparison */}
                <div className="mb-4 rounded-xl bg-elevated p-4">
                  <p className="mb-3 text-xs font-medium text-text-muted text-center">Score de Saúde Financeira</p>
                  <div className="flex items-center justify-around">
                    <ScoreGauge score={simulation.impact.baseline.score} label="Atual" />
                    <div className="flex flex-col items-center">
                      <span
                        className={`text-lg font-bold ${
                          simulation.impact.score_delta < 0 ? 'text-danger' : 'text-accent'
                        }`}
                      >
                        {simulation.impact.score_delta > 0 ? '+' : ''}{simulation.impact.score_delta}
                      </span>
                      <span className="text-xs text-text-muted">delta</span>
                    </div>
                    <ScoreGauge score={simulation.impact.projected.score} label="Projetado" />
                  </div>
                </div>

                {/* Verdict Badge */}
                <div
                  className={`rounded-2xl border p-4 text-center ${
                    VERDICT_CONFIG[simulation.impact.verdict].bg
                  }`}
                >
                  <p
                    className={`text-3xl font-bold mb-2 ${
                      VERDICT_CONFIG[simulation.impact.verdict].color
                    }`}
                  >
                    {VERDICT_CONFIG[simulation.impact.verdict].label}
                  </p>
                  <p className="text-sm text-text-muted">{simulation.impact.verdict_message}</p>
                  {simulation.impact.months_negative_balance > 0 && (
                    <p className="mt-2 text-xs text-danger">
                      {simulation.impact.months_negative_balance} mes(es) com saldo negativo projetado
                    </p>
                  )}
                </div>
              </div>

              {/* Timeline Chart */}
              {timelineData.length > 0 && (
                <div className="rounded-2xl border border-border-subtle bg-surface p-5">
                  <h3 className="mb-4 text-sm font-semibold text-text-primary">Impacto no Saldo</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#243044" />
                      <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} width={70} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          border: '1px solid #243044',
                          borderRadius: '12px',
                        }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <ReferenceLine y={0} stroke="#f87171" strokeDasharray="4 2" label={{ value: '0', fill: '#f87171', fontSize: 10 }} />
                      <Line
                        type="monotone"
                        dataKey="saldo"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        dot={false}
                        name="Saldo Projetado"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Amortization Area Chart */}
              {scheduleData.length > 1 && (
                <div className="rounded-2xl border border-border-subtle bg-surface p-5">
                  <h3 className="mb-4 text-sm font-semibold text-text-primary">Juros × Amortização</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={scheduleData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#243044" />
                      <XAxis dataKey="parcela" tick={{ fill: '#94a3b8', fontSize: 10 }} label={{ value: 'Parcela', position: 'insideBottom', offset: -2, fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} width={60} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          border: '1px solid #243044',
                          borderRadius: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area
                        type="monotone"
                        dataKey="Juros"
                        stackId="1"
                        stroke="#f87171"
                        fill="#f87171"
                        fillOpacity={0.4}
                      />
                      <Area
                        type="monotone"
                        dataKey="Amortização"
                        stackId="1"
                        stroke="#34d399"
                        fill="#34d399"
                        fillOpacity={0.4}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Opportunity Cost */}
              <div className="rounded-2xl border border-border-subtle bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-text-muted">Custo de Oportunidade</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      O que você deixaria de ganhar investindo o mesmo valor
                    </p>
                  </div>
                  <MoneyText
                    value={simulation.impact.opportunity_cost}
                    className="text-lg font-bold text-warning"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => saveMutation.mutate(formValues as SimulatorFormData)}
                  disabled={saveMutation.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border-subtle px-4 py-2.5 text-sm text-text-muted hover:bg-elevated transition-colors disabled:opacity-50"
                >
                  <Save size={15} />
                  Salvar Simulação
                </button>
                <button
                  onClick={() => setActivateOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent/20 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/30 transition-colors"
                >
                  <Play size={15} />
                  Ativar Aquisição
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-64 items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-surface">
              <div className="text-center">
                <TrendingDown size={32} className="mx-auto mb-3 text-text-muted" />
                <p className="text-sm font-medium text-text-primary">Resultado aparece aqui</p>
                <p className="mt-1 text-xs text-text-muted">Preencha o formulário e clique em Simular</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Acquisitions List */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Aquisições Ativas</h2>
        {acqLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !acquisitions?.results.length ? (
          <EmptyState
            icon={<ShoppingBag size={32} />}
            title="Nenhuma aquisição salva"
            description="Use o simulador acima para planejar e ativar uma nova aquisição"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {acquisitions.results.map((acq) => {
              const progress = acq.installment_total > 0
                ? (acq.installment_current / acq.installment_total) * 100
                : 0
              return (
                <div
                  key={acq.id}
                  className="rounded-2xl border border-border-subtle bg-surface p-4"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="font-medium text-text-primary">{acq.name}</p>
                      <p className="text-xs text-text-muted capitalize">{acq.acquisition_type}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        acq.is_active
                          ? 'bg-accent/10 text-accent'
                          : 'bg-text-muted/10 text-text-muted'
                      }`}
                    >
                      {acq.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="mb-2 flex justify-between text-xs text-text-muted">
                    <span>
                      Parcela {acq.installment_current}/{acq.installment_total}
                    </span>
                    <MoneyText value={acq.installment_amount} className="font-medium text-text-primary" />
                  </div>
                  <div className="mb-3 h-2 overflow-hidden rounded-full bg-elevated">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setCancelId(acq.id)}
                      className="text-xs text-text-muted hover:text-danger transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Confirm Activate */}
      <ConfirmDialog
        open={activateOpen}
        title="Ativar Aquisição"
        description="Isso criará um gasto fixo mensal correspondente às parcelas desta aquisição. O compromisso aparecerá nos gastos fixos a cada mês."
        confirmLabel="Ativar"
        onConfirm={() => activateMutation.mutate(formValues as SimulatorFormData)}
        onCancel={() => setActivateOpen(false)}
      />

      {/* Confirm Cancel */}
      <ConfirmDialog
        open={cancelId !== null}
        title="Cancelar Aquisição"
        description="A aquisição e seu gasto fixo associado serão removidos. Esta ação não pode ser desfeita."
        confirmLabel="Cancelar Aquisição"
        onConfirm={() => cancelId !== null && cancelMutation.mutate(cancelId)}
        onCancel={() => setCancelId(null)}
      />
    </div>
  )
}
