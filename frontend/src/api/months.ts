import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { GenerateFixedResult, MonthSummary } from '@/types/models'

export function useMonthSummary(year: number, month: number) {
  return useQuery({
    queryKey: ['summary', year, month],
    queryFn: () =>
      api.get<MonthSummary>(`/months/${year}/${month}/summary/`).then((r) => r.data),
  })
}

export function useGenerateFixed(year: number, month: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api
        .post<GenerateFixedResult>(`/months/${year}/${month}/generate-fixed/`)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['summary', year, month] })
      void qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useMonthSummaries(points: Array<{ year: number; month: number }>) {
  return useQueries({
    queries: points.map(({ year, month }) => ({
      queryKey: ['summary', year, month],
      queryFn: () =>
        api.get<MonthSummary>(`/months/${year}/${month}/summary/`).then((r) => r.data),
    })),
  })
}

export function useGenerateVariables(year: number, month: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (overrides: Array<{ recurring_id: number; amount: string }>) =>
      api
        .post<{ created: number; skipped: number }>(
          `/months/${year}/${month}/generate-variables/`,
          overrides,
        )
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['summary', year, month] })
      void qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
