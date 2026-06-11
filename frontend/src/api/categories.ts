import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Category, PaginatedResponse } from '@/types/api'

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
