import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// Response interceptor — auto refresh on 401 with single-flight queue
let isRefreshing = false
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error as { config?: { _retry?: boolean; headers?: Record<string, string> }; response?: { status?: number } }
    const originalRequest = axiosError.config

    // login/refresh 401 = credenciais inválidas: rejeita sem refresh nem redirect (preserva o formulário)
    const isAuthCall = String((originalRequest as { url?: string } | undefined)?.url ?? '').includes('/auth/token/')

    if (axiosError.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthCall) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${String(token)}`
          }
          return api(originalRequest as Parameters<typeof api>[0])
        })
      }

      originalRequest._retry = true
      isRefreshing = true
      const refresh = localStorage.getItem('refresh_token')

      if (!refresh) {
        isRefreshing = false
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post<{ access: string; refresh: string }>(
          `${BASE_URL}/auth/token/refresh/`,
          { refresh }
        )
        accessToken = data.access
        localStorage.setItem('refresh_token', data.refresh)
        processQueue(null, data.access)
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access}`
        }
        return api(originalRequest as Parameters<typeof api>[0])
      } catch (err) {
        processQueue(err, null)
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
