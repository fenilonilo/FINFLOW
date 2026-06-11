import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import MoneyText from '@/components/ui/MoneyText'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import type { Debt, PaginatedResponse } from '@/types/api'
import { DollarSign, ArrowRight, CheckCircle2 } from 'lucide-react'

const DEBT_TYPE_LABELS: Record<string, string> = {
  financing: 'Financiamento',
  personal_loan: 'Empréstimo Pessoal',
  credit_card: 'Cartão de Crédito',
  consortium: 'Consórcio',
  other: 'Outro',
}

export default function Debts() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<PaginatedResponse<Debt>>({
    queryKey: ['debts'],
    queryFn: () => api.get<PaginatedResponse<Debt>>('/debts/').then((r) => r.data),
  })

  const advanceMutation = useMutation({
    mutationFn: (id: number) => api.post(`/debts/${id}/advance/`),
    onSuccess: () => {
      toast('Parcela avançada', 'success')
      queryClient.invalidateQueries({ queryKey: ['debts'] })
    },
    onError: () => toast('Erro ao avançar parcela', 'error'),
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Dívidas</h1>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : !data?.results.length ? (
        <EmptyState
          icon={<DollarSign size={32} />}
          title="Nenhuma dívida registrada"
          description="Suas dívidas e financiamentos aparecerão aqui"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.results.map((debt) => {
            const progress =
              debt.installment_total > 0
                ? (debt.installment_current / debt.installment_total) * 100
                : 0

            return (
              <div
                key={debt.id}
                className={`rounded-2xl border bg-surface p-5 ${
                  debt.is_settled
                    ? 'border-accent/20 opacity-70'
                    : 'border-border-subtle'
                }`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text-primary">{debt.creditor}</p>
                      {debt.is_settled && (
                        <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                          <CheckCircle2 size={11} />
                          Quitada
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted">
                      {DEBT_TYPE_LABELS[debt.debt_type] ?? debt.debt_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <MoneyText value={debt.total_amount} className="font-bold text-text-primary" />
                    <p className="text-xs text-text-muted">total</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="mb-1 flex justify-between text-xs text-text-muted">
                    <span>
                      Parcela {debt.installment_current}/{debt.installment_total}
                    </span>
                    <MoneyText value={debt.installment_amount} className="font-medium" />
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-elevated">
                    <div
                      className={`h-full rounded-full transition-all ${
                        debt.is_settled ? 'bg-accent' : 'bg-info'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs text-text-muted">
                    {progress.toFixed(0)}% quitado
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Início: {new Date(debt.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  {!debt.is_settled && (
                    <button
                      onClick={() => advanceMutation.mutate(debt.id)}
                      disabled={advanceMutation.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-info/10 px-3 py-1.5 text-info hover:bg-info/20 transition-colors disabled:opacity-50"
                    >
                      <ArrowRight size={12} />
                      Avançar Parcela
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
