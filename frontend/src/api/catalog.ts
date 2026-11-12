import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Category, PaginatedResponse, PaymentMethod, RecurringExpense } from '@/types/models'

export function useCategories(params?: { is_archived?: boolean }) {
  return useQuery({
    queryKey: ['categories', params],
    queryFn: () =>
      api.get<PaginatedResponse<Category>>('/categories/', { params }).then((r) => r.data),
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<Category>) =>
      api.post<Category>('/categories/', payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<Category> & { id: number }) =>
      api.patch<Category>(`/categories/${id}/`, payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      void qc.invalidateQueries({ queryKey: ['summary'] })
    },
  })
}

export function useArchiveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.patch(`/categories/${id}/`, { is_archived: true }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: () =>
      api.get<PaginatedResponse<PaymentMethod>>('/payment-methods/').then((r) => r.data),
  })
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<PaymentMethod>) =>
      api.post<PaymentMethod>('/payment-methods/', payload).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  })
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<PaymentMethod> & { id: number }) =>
      api.patch<PaymentMethod>(`/payment-methods/${id}/`, payload).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  })
}

export function useArchivePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.patch(`/payment-methods/${id}/`, { is_archived: true }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  })
}

export function useRecurring() {
  return useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: () =>
      api.get<PaginatedResponse<RecurringExpense>>('/recurring-expenses/').then((r) => r.data),
  })
}

export function useCreateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<RecurringExpense>) =>
      api.post<RecurringExpense>('/recurring-expenses/', payload).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['recurring-expenses'] }),
  })
}

export function useUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<RecurringExpense> & { id: number }) =>
      api.patch<RecurringExpense>(`/recurring-expenses/${id}/`, payload).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['recurring-expenses'] }),
  })
}

export function usePauseRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.patch(`/recurring-expenses/${id}/`, { status: 'paused' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['recurring-expenses'] }),
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/recurring-expenses/${id}/`),
    onSuccess: () => {
      for (const key of ['recurring-expenses', 'transactions', 'summary'])
        void qc.invalidateQueries({ queryKey: [key] })
    },
  })
}
