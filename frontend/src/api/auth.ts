import { api } from './client'
import { getDeviceName } from '@/lib/device'
import type { User } from '@/types/models'

export interface TokenResponse {
  access: string
  refresh: string
}

export function postLogin(email: string, password: string) {
  return api.post<TokenResponse>('/auth/token/', { email, password, device_name: getDeviceName() })
}

export function postRefresh(refresh: string) {
  return api.post<TokenResponse>('/auth/token/refresh/', { refresh })
}

export function getMe() {
  return api.get<User>('/auth/me/')
}

export function postLogout(refresh: string | null) {
  return api.post('/auth/logout/', { refresh })
}
