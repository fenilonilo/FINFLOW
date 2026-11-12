import { useQuery } from '@tanstack/react-query'
import { usePeriod } from '@/contexts/PeriodContext'
import { api } from '@/api/client'
import MoneyText from '@/components/ui/MoneyText'
import Skeleton from '@/components/ui/Skeleton'
import type { MonthSummary, CardSummary } from '@/types/models'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const tooltipStyle = {
  contentStyle: { backgroundColor: '#111827', border: '1px solid #243044', borderRadius: '12px' },
  labelStyle: { color: '#f1f5f9' },
  itemStyle: { color: '#94a3b8' },
  formatter: (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v),
}

function HBar({ data }: { data: Array<{ name: string; total: number; color?: string }> }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-text-muted">Sem dados</p>
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#243044" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={110} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="total" fill="#60a5fa" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? '#60a5fa'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5">
      <h2 className="mb-4 text-sm font-semibold text-text-primary">{title}</h2>
      {children}
    </div>
  )
}

export default function Analytics() {
  const { year, month } = usePeriod()

  const { data, isLoading } = useQuery<MonthSummary>({
    queryKey: ['summary', year, month],
    queryFn: () => api.get<MonthSummary>(`/months/${year}/${month}/summary/`).then((r) => r.data),
  })

  const { data: cards, isLoading: cardsLoading } = useQuery<CardSummary[]>({
    queryKey: ['cards-summary', year, month],
    queryFn: () =>
      api.get<CardSummary[]>('/cards/summary/', { params: { year, month } }).then((r) => r.data),
  })

  if (isLoading || cardsLoading || !data) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
      </div>
    )
  }

  const inOut = [
    { name: 'Entradas', total: parseFloat(data.total_income), color: '#34d399' },
    { name: 'Saídas', total: parseFloat(data.total_expense), color: '#f87171' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-text-primary">Análise</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Entradas × Saídas">
          <HBar data={inOut} />
          <p className="mt-2 text-xs text-text-muted">
            Saldo: <MoneyText value={data.balance} className="font-semibold text-text-primary" />
          </p>
        </Card>

        <Card title="Faturas dos Cartões">
          {!cards?.length ? (
            <p className="py-8 text-center text-sm text-text-muted">Nenhum cartão cadastrado</p>
          ) : (
            <div className="space-y-3">
              {cards.map((c) => (
                <div key={c.card_id} className="flex items-center justify-between rounded-xl bg-elevated px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-sm text-text-primary">{c.name}</span>
                    <span className="text-xs text-text-muted">vence dia {c.due_day}</span>
                  </div>
                  <MoneyText value={c.invoice.amount} className="font-semibold" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Por Categoria">
          <HBar
            data={data.by_category.map((c) => ({
              name: c.category_name,
              total: parseFloat(c.total),
              color: c.color,
            }))}
          />
        </Card>

        <Card title="Por Origem">
          <HBar data={data.by_payment_method.map((p) => ({ name: p.name, total: parseFloat(p.total) }))} />
        </Card>
      </div>
    </div>
  )
}
