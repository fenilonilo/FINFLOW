import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { MonthSummary } from '@/types/api'

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
        .post<{ created: number; skipped: number; completed_templates: number[] }>(
          `/months/${year}/${month}/generate-fixed/`
        )
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['summary', year, month] })
      void qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
