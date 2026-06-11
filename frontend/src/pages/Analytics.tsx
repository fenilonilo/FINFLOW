import { useQuery } from '@tanstack/react-query'
import { usePeriod } from '@/contexts/PeriodContext'
import { api } from '@/api/client'
import { BarChart2 } from 'lucide-react'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
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

interface HeatmapEntry {
  date: string
  total: string
}

interface CategoryTrend {
  category_name: string
  color: string
  months: Array<{ month: number; year: number; total: string }>
}

interface TopCategory {
  category_name: string
  color: string
  total: string
}

function HeatmapGrid({ data }: { data: HeatmapEntry[] }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-text-muted">Sem dados de heatmap</p>

  // Build a map date→total
  const map: Record<string, number> = {}
  data.forEach((d) => {
    map[d.date] = parseFloat(d.total)
  })

  const values = Object.values(map)
  const maxVal = values.length ? Math.max(...values) : 1
  const q1 = maxVal * 0.25
  const q2 = maxVal * 0.5
  const q3 = maxVal * 0.75

  const getColor = (val: number) => {
    if (val <= 0) return '#1b2434'
    if (val < q1) return '#34d39933'
    if (val < q2) return '#34d39966'
    if (val < q3) return '#34d399aa'
    return '#34d399'
  }

  // Build weeks from Jan 1 of the relevant year
  const firstDate = data[0]?.date ? new Date(data[0].date) : new Date()
  const year = firstDate.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const startDayOfWeek = startOfYear.getDay()

  const weeks: Array<Array<{ date: string; val: number } | null>> = []
  let week: Array<{ date: string; val: number } | null> = Array(startDayOfWeek).fill(null)

  for (let d = 0; d < 365; d++) {
    const date = new Date(year, 0, d + 1)
    const dateStr = date.toISOString().slice(0, 10)
    week.push({ date: dateStr, val: map[dateStr] ?? 0 })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 mr-1">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="h-3 w-3 text-center text-xs text-text-muted leading-3">{d}</div>
          ))}
        </div>
        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((day, di) =>
              day ? (
                <div
                  key={di}
                  className="h-3 w-3 rounded-sm cursor-default transition-opacity hover:opacity-80"
                  style={{ backgroundColor: getColor(day.val) }}
                  title={`${day.date}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(day.val)}`}
                />
              ) : (
                <div key={di} className="h-3 w-3" />
              )
            )}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="mt-2 flex items-center gap-1 text-xs text-text-muted">
        <span>Menos</span>
        {['#1b2434', '#34d39933', '#34d39966', '#34d399aa', '#34d399'].map((c, i) => (
          <div key={i} className="h-3 w-3 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span>Mais</span>
      </div>
    </div>
  )
}

export default function Analytics() {
  const { year } = usePeriod()

  const { data: yearly, isLoading: yearlyLoading } = useQuery<YearlyData>({
    queryKey: ['yearly', year],
    queryFn: () => api.get<YearlyData>(`/analytics/yearly/?year=${year}`).then((r) => r.data),
  })

  const { data: heatmap, isLoading: heatmapLoading } = useQuery<HeatmapEntry[]>({
    queryKey: ['heatmap', year],
    queryFn: () =>
      api.get<HeatmapEntry[]>(`/analytics/heatmap/?year=${year}`).then((r) => r.data),
  })

  const { data: categoryTrends, isLoading: trendsLoading } = useQuery<CategoryTrend[]>({
    queryKey: ['category-trends', year],
    queryFn: () =>
      api.get<CategoryTrend[]>(`/analytics/category-trends/?year=${year}`).then((r) => r.data),
  })

  const { data: topCategories, isLoading: topLoading } = useQuery<TopCategory[]>({
    queryKey: ['top-categories', year],
    queryFn: () =>
      api.get<TopCategory[]>(`/analytics/top-categories/?year=${year}&limit=8`).then((r) => r.data),
  })

  const annualCompareData = yearly?.months.map((m) => ({
    name: MONTH_NAMES[m.month - 1],
    Entradas: parseFloat(m.total_income),
    Saídas: parseFloat(m.total_expense),
    Investido: parseFloat(m.total_invested),
  })) ?? []

  const topCatData = (topCategories ?? []).map((c) => ({
    name: c.category_name,
    total: parseFloat(c.total),
    fill: c.color,
  }))

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#111827',
      border: '1px solid #243044',
      borderRadius: '12px',
    },
    labelStyle: { color: '#f1f5f9' },
    itemStyle: { color: '#94a3b8' },
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-text-primary">Análises</h1>

      {/* Heatmap */}
      <div className="rounded-2xl border border-border-subtle bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Heatmap de Gastos {year}</h2>
        {heatmapLoading ? (
          <Skeleton className="h-24" />
        ) : (
          <HeatmapGrid data={heatmap ?? []} />
        )}
      </div>

      {/* Comparative Bar Chart */}
      <div className="rounded-2xl border border-border-subtle bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Comparativo Anual {year}</h2>
        {yearlyLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={annualCompareData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243044" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={70} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Entradas" fill="#34d399" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Saídas" fill="#f87171" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Investido" fill="#fbbf24" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Category Trend Lines */}
      <div className="rounded-2xl border border-border-subtle bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Tendência por Categoria (últimos 6 meses)</h2>
        {trendsLoading ? (
          <Skeleton className="h-64" />
        ) : !categoryTrends?.length ? (
          <EmptyState icon={<BarChart2 size={32} />} title="Sem dados para o período selecionado" />
        ) : (
          (() => {
            // Build chart data: [{name: 'Jan', 'Saúde': 100, 'Alimentação': 200}, ...]
            const months6 = yearly?.months.slice(-6) ?? []
            const chartData = months6.map((m) => {
              const entry: Record<string, unknown> = { name: MONTH_NAMES[m.month - 1] }
              categoryTrends.forEach((cat) => {
                const monthData = cat.months.find((cm) => cm.month === m.month)
                entry[cat.category_name] = monthData ? parseFloat(monthData.total) : 0
              })
              return entry
            })

            const avgLine = months6.map((m) => {
              const total = categoryTrends.reduce((sum, cat) => {
                const monthData = cat.months.find((cm) => cm.month === m.month)
                return sum + (monthData ? parseFloat(monthData.total) : 0)
              }, 0)
              return { name: MONTH_NAMES[m.month - 1], média: total / categoryTrends.length }
            })

            const combined = chartData.map((d, i) => ({ ...d, ...avgLine[i] }))

            return (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={combined}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#243044" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={70} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {categoryTrends.map((cat) => (
                    <Line
                      key={cat.category_name}
                      type="monotone"
                      dataKey={cat.category_name}
                      stroke={cat.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="média"
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    dot={false}
                    name="Média"
                  />
                </LineChart>
              </ResponsiveContainer>
            )
          })()
        )}
      </div>

      {/* Top Categories Horizontal Bar */}
      <div className="rounded-2xl border border-border-subtle bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Top 8 Categorias</h2>
        {topLoading ? (
          <Skeleton className="h-64" />
        ) : !topCatData.length ? (
          <p className="py-8 text-center text-sm text-text-muted">Sem dados de categorias</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topCatData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#243044" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                width={90}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(value: number) =>
                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
                }
              />
              <Bar
                dataKey="total"
                radius={[0, 4, 4, 0]}
                name="Total"
              >
                {topCatData.map((entry, index) => (
                  <rect key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
