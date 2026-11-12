import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Transaction, PaginatedResponse } from '@/types/models'

export interface TransactionFilters {
  year?: number
  month?: number
  type?: string
  kind?: string
  category?: number
  page?: number
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () =>
      api
        .get<PaginatedResponse<Transaction>>('/transactions/', { params: filters })
        .then((r) => r.data),
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<Transaction>) =>
      api.post<Transaction>('/transactions/', payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] })
      void qc.invalidateQueries({ queryKey: ['summary'] })
      void qc.invalidateQueries({ queryKey: ['yearly'] })
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<Transaction> & { id: number }) =>
      api.patch<Transaction>(`/transactions/${id}/`, payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] })
      void qc.invalidateQueries({ queryKey: ['summary'] })
      void qc.invalidateQueries({ queryKey: ['yearly'] })
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/transactions/${id}/`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] })
      void qc.invalidateQueries({ queryKey: ['summary'] })
      void qc.invalidateQueries({ queryKey: ['yearly'] })
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

// Segue `next` até o fim (a API pagina 50 por página).
export function useMonthTransactions(year: number, month: number) {
  return useQuery({
    queryKey: ['transactions', year, month, 'all'],
    queryFn: async () => {
      const all: Transaction[] = []
      let page = 1
      for (;;) {
        const { data } = await api.get<PaginatedResponse<Transaction>>('/transactions/', {
          params: { year, month, page },
        })
        all.push(...data.results)
        if (!data.next) return all
        page += 1
      }
    },
  })
}
