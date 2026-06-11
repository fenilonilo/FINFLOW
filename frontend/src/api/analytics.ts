import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { FinancialHealth } from '@/types/api'

export interface YearlyMonth {
  month: number
  total_income: string
  total_expense: string
  total_invested: string
  balance: string
}

export interface YearlySummary {
  year: number
  months: YearlyMonth[]
}

export function useHealthScore() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<FinancialHealth>('/analytics/health-score/').then((r) => r.data),
  })
}

export function useYearlySummary(year: number) {
  return useQuery({
    queryKey: ['yearly', year],
    queryFn: () =>
      api.get<YearlySummary>('/analytics/yearly/', { params: { year } }).then((r) => r.data),
  })
}
