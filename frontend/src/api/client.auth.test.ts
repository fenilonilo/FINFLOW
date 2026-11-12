import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { api } from './client'

const calls: string[] = []
const server = setupServer(
  http.post('*/auth/token/', () => HttpResponse.json({ detail: 'x' }, { status: 401 })),
  http.post('*/auth/token/refresh/', () => { calls.push('refresh'); return HttpResponse.json({}, { status: 401 }) }),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => { server.resetHandlers(); calls.length = 0; localStorage.clear() })
afterAll(() => server.close())

describe('interceptor 401', () => {
  it('401 no login rejeita sem refresh nem redirect', async () => {
    localStorage.setItem('refresh_token', 'r')
    api.defaults.baseURL = 'http://localhost/api/v1'
    const hrefSet = vi.fn()
    const loc = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...loc, set href(v: string) { hrefSet(v) } } })
    await expect(api.post('/auth/token/', { email: 'a', password: 'b' })).rejects.toMatchObject({ response: { status: 401 } })
    expect(calls).toEqual([])
    expect(hrefSet).not.toHaveBeenCalled()
    expect(localStorage.getItem('refresh_token')).toBe('r')
    Object.defineProperty(window, 'location', { configurable: true, value: loc })
  })
})
