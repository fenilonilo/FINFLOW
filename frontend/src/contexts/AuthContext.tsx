import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api, setAccessToken } from '@/api/client'
import type { User } from '@/types/models'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const refresh = localStorage.getItem('refresh_token')
    if (!refresh) {
      setIsLoading(false)
      return
    }
    api
      .post<{ access: string; refresh: string }>('/auth/token/refresh/', { refresh })
      .then(({ data }) => {
        setAccessToken(data.access)
        localStorage.setItem('refresh_token', data.refresh)
        return api.get<User>('/auth/me/')
      })
      .then(({ data }) => setUser(data))
      .catch(() => localStorage.removeItem('refresh_token'))
      .finally(() => setIsLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const { data } = await api.post<{ access: string; refresh: string }>('/auth/token/', {
      email,
      password,
    })
    setAccessToken(data.access)
    localStorage.setItem('refresh_token', data.refresh)
    const me = await api.get<User>('/auth/me/')
    setUser(me.data)
  }

  async function logout() {
    const refresh = localStorage.getItem('refresh_token')
    try {
      await api.post('/auth/logout/', { refresh })
    } catch {
      // ignore logout errors
    }
    setAccessToken(null)
    localStorage.removeItem('refresh_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
