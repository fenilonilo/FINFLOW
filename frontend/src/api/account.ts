import { useMutation } from '@tanstack/react-query'
import { api } from './client'
import { useAuth } from '@/contexts/AuthContext'
import type { User } from '@/types/models'

export function useUpdateMe() {
  const { setUser } = useAuth()
  return useMutation({
    mutationFn: (payload: { first_name: string; email: string }) =>
      api.patch<User>('/auth/me/', payload).then((r) => r.data),
    onSuccess: setUser,
  })
}

export function useUploadAvatar() {
  const { setUser } = useAuth()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('avatar', file)
      return api
        .post<User>('/auth/me/avatar/', form, { headers: { 'Content-Type': undefined } })
        .then((r) => r.data)
    },
    onSuccess: setUser,
  })
}

export function useDeleteAvatar() {
  const { setUser } = useAuth()
  return useMutation({
    mutationFn: () => api.delete('/auth/me/avatar/'),
    onSuccess: () => setUser((u) => u && { ...u, avatar_url: null }),
  })
}
