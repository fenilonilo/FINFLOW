import { api } from './client'
import { getDeviceName } from '@/lib/device'

export interface TokenResponse {
  access: string
  refresh: string
}

export function postLogin(email: string, password: string) {
  return api.post<TokenResponse>('/auth/token/', { email, password, device_name: getDeviceName() })
}
