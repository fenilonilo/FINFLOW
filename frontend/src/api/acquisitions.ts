import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { SimulationResult, PaginatedResponse } from '@/types/api'

export interface AcquisitionItem {
  id: number
  name: string
  total_value: string
  down_payment: string
  installments: number
  monthly_rate: string
  status: string
  created_at: string
}

export interface SimulatePayload {
  name: string
  total_value: string
  down_payment?: string
  installments?: number
  monthly_rate?: string
}

export function useAcquisitions() {
  return useQuery({
    queryKey: ['acquisitions'],
    queryFn: () =>
      api.get<PaginatedResponse<AcquisitionItem>>('/acquisitions/').then((r) => r.data),
  })
}

export function useSimulateAcquisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SimulatePayload) =>
      api.post<SimulationResult>('/acquisitions/simulate/', payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useDeleteAcquisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/acquisitions/${id}/`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['acquisitions'] })
      void qc.invalidateQueries({ queryKey: ['summary'] })
      void qc.invalidateQueries({ queryKey: ['yearly'] })
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}
