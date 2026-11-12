import { describe, test, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { api } from './client'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { useMonthTransactions } from './transactions'
import { usePayInvoice, useUpdateCard } from './cards'
import { useImportStatement } from './imports'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  localStorage.removeItem('refresh_token')
  vi.restoreAllMocks()
})
afterAll(() => server.close())

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}

const tx = (id: number) => ({ id })

test('useMonthTransactions follows pagination', async () => {
  server.use(
    http.get('*/api/v1/transactions/', ({ request }) => {
      const url = new URL(request.url)
      expect(url.searchParams.get('year')).toBe('2026')
      const page = url.searchParams.get('page')
      return page === '2'
        ? HttpResponse.json({ count: 57, next: null, previous: null, results: Array.from({ length: 7 }, (_, i) => tx(100 + i)) })
        : HttpResponse.json({
            count: 57,
            next: `${url.origin}/api/v1/transactions/?year=2026&month=11&page=2`,
            previous: null,
            results: Array.from({ length: 50 }, (_, i) => tx(i)),
          })
    }),
  )
  const { result } = renderHook(() => useMonthTransactions(2026, 11), { wrapper })
  await waitFor(() => expect(result.current.data).toHaveLength(57))
})

describe('mutations', () => {
  test('login sends device_name', async () => {
    let body: Record<string, string> = {}
    server.use(
      http.get('*/api/v1/auth/me/', () => HttpResponse.json({ id: 1, email: 'a@b.c', first_name: 'A', avatar_url: null })),
      http.post('*/api/v1/auth/token/', async ({ request }) => {
        body = (await request.json()) as Record<string, string>
        return HttpResponse.json({ access: 'a', refresh: 'r' })
      }),
    )
    localStorage.removeItem('refresh_token')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(() => result.current.login('a@b.c', 'pw'))
    expect(body.email).toBe('a@b.c')
    expect(body.device_name).toMatch(/ · /)
  })

  test('usePayInvoice posts year/month/is_paid', async () => {
    let body: unknown
    server.use(
      http.post('*/api/v1/cards/7/pay-invoice/', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({})
      }),
    )
    const { result } = renderHook(() => usePayInvoice(), { wrapper })
    await act(() => result.current.mutateAsync({ cardId: 7, year: 2026, month: 11, is_paid: true }))
    expect(body).toEqual({ year: 2026, month: 11, is_paid: true })
  })

  test('useImportStatement sends dry_run and categories JSON', async () => {
    // jsdom FormData + msw request body hangs, so inspect the FormData handed to axios
    const forms: FormData[] = []
    const urls: string[] = []
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    vi.spyOn(api, 'post').mockImplementation(async (url, data) => {
      urls.push(url)
      forms.push(data as FormData)
      return { data: { created: 0, skipped: 0, total: '0.00', items: [] } }
    })
    const { result } = renderHook(() => useImportStatement(), { wrapper })
    const base = { file: new File(['x'], 'f.csv'), cardId: 1, kind: 'credit' as const, year: 2026, month: 11 }
    await act(() => result.current.mutateAsync({ ...base, dryRun: true }))
    expect(invalidate).not.toHaveBeenCalled()
    await act(() => result.current.mutateAsync({ ...base, categories: { 0: 3 } }))
    expect(invalidate).toHaveBeenCalled()
    expect(urls).toEqual(['/imports/statement/', '/imports/statement/'])
    expect(forms[0].get('dry_run')).toBe('true')
    expect(forms[0].get('card_id')).toBe('1')
    expect(forms[0].has('categories')).toBe(false)
    expect(forms[1].get('dry_run')).toBe('false')
    expect(forms[1].get('categories')).toBe('{"0":3}')
  })

  test('useUpdateCard omits limit from PATCH when not passed', async () => {
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.patch('*/api/v1/cards/5/', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({})
      }),
    )
    const { result } = renderHook(() => useUpdateCard(), { wrapper })
    await act(() => result.current.mutateAsync({ id: 5, name: 'X' }))
    await act(() => result.current.mutateAsync({ id: 5, limit: '' }))
    expect(bodies[0]).toEqual({ name: 'X' })
    expect(bodies[1]).toEqual({ limit: null })
  })
})
