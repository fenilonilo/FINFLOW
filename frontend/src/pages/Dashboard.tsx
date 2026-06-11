import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePeriod } from '@/contexts/PeriodContext'
import { api } from '@/api/client'
import KpiCard from '@/components/ui/KpiCard'
import MoneyText from '@/components/ui/MoneyText'
import Skeleton from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import type { MonthSummary, FinancialHealth } from '@/types/api'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface YearlyData {
  year: number
  months: Array<{
    month: number
    total_income: string
    total_expense: string
    total_invested: string
    balance: string
  }>
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const pct = score / 100
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const halfCirc = circumference / 2
  const color =
    score >= 80 ? '#34d399' : score >= 60 ? '#60a5fa' : score >= 40 ? '#fbbf24' : '#f87171'
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="60" viewBox="0 0 100 60">
        <path
          d={`M 10 50 A 40 40 0 0 1 90 50`}
          fill="none"
          stroke="#243044"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={`M 10 50 A 40 40 0 0 1 90 50`}
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

export default function Dashboard() {
  const { year, month } = usePeriod()
  const queryClient = useQueryClient()
  const [fixosBannerDismissed, setFixosBannerDismissed] = useState(false)

  const { data, isLoading } = useQuery<MonthSummary>({
    queryKey: ['summary', year, month],
    queryFn: () =>
      api.get<MonthSummary>(`/months/${year}/${month}/summary/`).then((r) => r.data),
  })

  const { data: yearly, isLoading: yearlyLoading } = useQuery<YearlyData>({
    queryKey: ['yearly', year],
    queryFn: () => api.get<YearlyData>(`/analytics/yearly/?year=${year}`).then((r) => r.data),
  })

  const { data: health, isLoading: healthLoading } = useQuery<FinancialHealth>({
    queryKey: ['health', year, month],
    queryFn: () =>
      api
        .get<FinancialHealth>(`/analytics/health-score/?year=${year}&month=${month}`)
        .then((r) => r.data),
  })

  const generateFixed = useMutation({
    mutationFn: () =>
      api
        .post<{ created: number; skipped: number }>(`/months/${year}/${month}/generate-fixed/`)
        .then((r) => r.data),
    onSuccess: (result) => {
      toast(
        `Fixos gerados: ${result.created} criados, ${result.skipped} ignorados`,
        'success'
      )
      setFixosBannerDismissed(true)
      queryClient.invalidateQueries({ queryKey: ['summary', year, month] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
    onError: () => toast('Erro ao gerar fixos', 'error'),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const showGenerateBanner = !fixosBannerDismissed && data.pending_count === 0

  const categoryData = data.by_category.map((c) => ({
    name: c.category_name,
    value: parseFloat(c.total),
    color: c.color,
    budget: c.budget ? parseFloat(c.budget) : null,
    used_pct: c.budget_used_pct,
  }))

  const yearlyChartData =
    yearly?.months.map((m) => ({
      name: MONTH_NAMES[m.month - 1],
      Entradas: parseFloat(m.total_income),
      Saídas: parseFloat(m.total_expense),
      Investido: parseFloat(m.total_invested),
    })) ?? []

  const paymentData = data.by_payment_method.map((p) => ({
    name: p.name,
    total: parseFloat(p.total),
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard
          title="Entradas"
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            parseFloat(data.total_income)
          )}
          rawValue={parseFloat(data.total_income)}
          icon={<TrendingUp size={16} />}
          variant="positive"
          animate
        />
        <KpiCard
          title="Saídas"
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            parseFloat(data.total_expense)
          )}
          rawValue={parseFloat(data.total_expense)}
          icon={<TrendingDown size={16} />}
          variant="negative"
          animate
        />
        <KpiCard
          title="Investido"
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            parseFloat(data.total_invested)
          )}
          rawValue={parseFloat(data.total_invested)}
          icon={<PiggyBank size={16} />}
          variant="warning"
          animate
        />
        <KpiCard
          title="Saldo"
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            parseFloat(data.balance)
          )}
          rawValue={parseFloat(data.balance)}
          icon={<Wallet size={16} />}
          variant={parseFloat(data.balance) >= 0 ? 'positive' : 'negative'}
          animate
        />
        <KpiCard
          title="Pendências"
          value={String(data.pending_count)}
          icon={<Clock size={16} />}
          variant={data.pending_count > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Generate Fixed Banner */}
      {showGenerateBanner && (
        <div className="flex items-center justify-between rounded-2xl border border-warning/30 bg-warning/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-warning" />
            <div>
              <p className="text-sm font-medium text-warning">Gerar lançamentos fixos</p>
              <p className="text-xs text-text-muted">
                Clique para criar automaticamente os lançamentos fixos de {MONTH_NAMES[month - 1]}/{year}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => generateFixed.mutate()}
              disabled={generateFixed.isPending}
              className="flex items-center gap-2 rounded-xl bg-warning/20 px-4 py-2 text-sm font-medium text-warning hover:bg-warning/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={generateFixed.isPending ? 'animate-spin' : ''} />
              {generateFixed.isPending ? 'Gerando...' : 'Gerar Fixos'}
            </button>
            <button
              onClick={() => setFixosBannerDismissed(true)}
              className="rounded-xl px-3 py-2 text-xs text-text-muted hover:bg-elevated transition-colors"
            >
              Dispensar
            </button>
          </div>
        </div>
      )}

      {/* Charts Row 1: Category Donut + Annual Line */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Category Donut */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Gastos por Categoria</h3>
          {categoryData.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">Sem dados de categorias</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) =>
                      new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(value)
                    }
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #243044',
                      borderRadius: '12px',
                    }}
                    labelStyle={{ color: '#f1f5f9' }}
                    itemStyle={{ color: '#94a3b8' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1">
                {categoryData.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="flex-1 truncate text-xs text-text-muted">{c.name}</span>
                    <MoneyText
                      value={String(c.value)}
                      className="text-xs font-medium"
                    />
                    {c.budget && (
                      <span className="text-xs text-text-muted">({c.used_pct}%)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Annual Line Chart */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Evolução Anual {year}</h3>
          {yearlyLoading ? (
            <Skeleton className="h-48" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={yearlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#243044" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={60} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #243044',
                    borderRadius: '12px',
                  }}
                  labelStyle={{ color: '#f1f5f9' }}
                  itemStyle={{ color: '#94a3b8' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Entradas" stroke="#34d399" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Saídas" stroke="#f87171" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Investido" stroke="#fbbf24" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2: Payment Methods Bar + Health Score */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Payment Methods Bar */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Por Forma de Pagamento</h3>
          {paymentData.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={paymentData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#243044" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(value)
                  }
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #243044',
                    borderRadius: '12px',
                  }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="total" fill="#60a5fa" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Health Score */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Saúde Financeira</h3>
          {healthLoading ? (
            <Skeleton className="h-48" />
          ) : health ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <ScoreGauge score={health.score} label={health.score_label} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-elevated p-3">
                  <p className="text-xs text-text-muted">Renda Média</p>
                  <MoneyText value={health.avg_monthly_income} className="font-semibold text-accent" />
                </div>
                <div className="rounded-xl bg-elevated p-3">
                  <p className="text-xs text-text-muted">Gasto Médio</p>
                  <MoneyText value={health.avg_monthly_expense} className="font-semibold text-danger" />
                </div>
                <div className="rounded-xl bg-elevated p-3">
                  <p className="text-xs text-text-muted">Taxa de Poupança</p>
                  <p className="font-semibold text-warning">{health.savings_rate_pct}%</p>
                </div>
                <div className="rounded-xl bg-elevated p-3">
                  <p className="text-xs text-text-muted">Compromisso Fixo</p>
                  <p className="font-semibold text-info">{health.fixed_commitment_pct}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-elevated px-3 py-2">
                <CheckCircle2 size={14} className="text-accent" />
                <span className="text-xs text-text-muted">
                  Saldo médio: <MoneyText value={health.avg_balance} className="text-text-primary" />
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
