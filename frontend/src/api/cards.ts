import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Card, CardInvoice, CardSummary, PaginatedResponse } from '@/types/models'

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
      api.post<Card>('/cards/', { ...payload, limit: payload.limit || null }).then((r) => r.data),
    onSuccess: () => invalidateCards(qc),
  })
}

function invalidateCards(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['payment-methods'] })
  void qc.invalidateQueries({ queryKey: ['cards-summary'] })
  void qc.invalidateQueries({ queryKey: ['cards'] })
}

export function useUpdateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<Card> & { id: number }) =>
      api
        .patch<Card>(`/cards/${id}/`, 'limit' in payload ? { ...payload, limit: payload.limit || null } : payload)
        .then((r) => r.data),
    onSuccess: () => invalidateCards(qc),
  })
}

export function useToggleCardActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch<Card>(`/cards/${id}/`, { is_active }).then((r) => r.data),
    onSuccess: () => invalidateCards(qc),
  })
}

export function useCardsSummary(year: number, month: number) {
  return useQuery({
    queryKey: ['cards-summary', year, month],
    queryFn: () =>
      api.get<CardSummary[]>('/cards/summary/', { params: { year, month } }).then((r) => r.data),
  })
}

export function usePayInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ cardId, year, month, is_paid }: { cardId: number; year: number; month: number; is_paid: boolean }) =>
      api.post(`/cards/${cardId}/pay-invoice/`, { year, month, is_paid }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cards-summary'] })
      void qc.invalidateQueries({ queryKey: ['transactions'] })
      void qc.invalidateQueries({ queryKey: ['summary'] })
      void qc.invalidateQueries({ queryKey: ['debts'] })
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
