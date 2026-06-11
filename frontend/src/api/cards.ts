import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Card, CardInvoice, PaginatedResponse } from '@/types/api'

export function useCards() {
  return useQuery({
    queryKey: ['cards'],
    queryFn: () => api.get<PaginatedResponse<Card>>('/cards/').then((r) => r.data),
  })
}

export function useCardInvoices(params?: { year?: number; month?: number }) {
  return useQuery({
    queryKey: ['card-invoices', params],
    queryFn: () =>
      api.get<PaginatedResponse<CardInvoice>>('/cards/invoices/', { params }).then((r) => r.data),
  })
}

export function useCreateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<Card>) =>
      api.post<Card>('/cards/', payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cards'] })
    },
  })
}

export function useToggleInvoicePaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_paid }: { id: number; is_paid: boolean }) =>
      api.patch<CardInvoice>(`/cards/invoices/${id}/`, { is_paid }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['card-invoices'] })
      void qc.invalidateQueries({ queryKey: ['summary'] })
    },
  })
}
