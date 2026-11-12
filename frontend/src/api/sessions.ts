import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { DeviceSession } from '@/types/models'

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<DeviceSession[]>('/auth/sessions/').then((r) => r.data),
  })
}

export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/auth/sessions/${id}/`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}
