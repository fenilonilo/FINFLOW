import { useQuery } from '@tanstack/react-query'
import { usePeriod } from '@/contexts/PeriodContext'
import { api } from '@/api/client'
import KpiCard from '@/components/ui/KpiCard'
import MoneyText from '@/components/ui/MoneyText'
import Skeleton from '@/components/ui/Skeleton'
import { TrendingUp, TrendingDown, Wallet, Lock, Shuffle } from 'lucide-react'
import type { MonthSummary } from '@/types/models'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const brl = (v: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(v))

export default function Dashboard() {
  const { year, month } = usePeriod()
  const { data, isLoading } = useQuery<MonthSummary>({
    queryKey: ['summary', year, month],
    queryFn: () =>
      api.get<MonthSummary>(`/months/${year}/${month}/summary/`).then((r) => r.data),
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

  const categoryData = data.by_category.map((c) => ({
    name: c.category_name,
    value: parseFloat(c.total),
    color: c.color,
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard title="Entradas" value={brl(data.total_income)} rawValue={parseFloat(data.total_income)} icon={<TrendingUp size={16} />} variant="positive" animate />
        <KpiCard title="Saídas" value={brl(data.total_expense)} rawValue={parseFloat(data.total_expense)} icon={<TrendingDown size={16} />} variant="negative" animate />
        <KpiCard title="Saldo" value={brl(data.balance)} rawValue={parseFloat(data.balance)} icon={<Wallet size={16} />} variant={parseFloat(data.balance) >= 0 ? 'positive' : 'negative'} animate />
        <KpiCard title="Fixos" value={brl(data.total_fixed)} rawValue={parseFloat(data.total_fixed)} icon={<Lock size={16} />} animate />
        <KpiCard title="Variáveis" value={brl(data.total_variable)} rawValue={parseFloat(data.total_variable)} icon={<Shuffle size={16} />} animate />
      </div>

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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
    </div>
  )
}
