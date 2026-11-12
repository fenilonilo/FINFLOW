import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Investment, PaginatedResponse } from '@/types/models'

export function useInvestments(params?: { year?: number; month?: number }) {
  return useQuery({
    queryKey: ['investments', params],
    queryFn: () =>
      api.get<PaginatedResponse<Investment>>('/investments/', { params }).then((r) => r.data),
  })
}

export function useCreateInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<Investment>) =>
      api.post<Investment>('/investments/', payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['investments'] })
      void qc.invalidateQueries({ queryKey: ['summary'] })
      void qc.invalidateQueries({ queryKey: ['yearly'] })
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useDeleteInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/investments/${id}/`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['investments'] })
      void qc.invalidateQueries({ queryKey: ['summary'] })
      void qc.invalidateQueries({ queryKey: ['yearly'] })
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}
