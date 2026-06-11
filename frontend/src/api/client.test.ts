import { describe, it, expect } from 'vitest'

// Tests for the refresh interceptor queue logic
// The singleton api client cannot be imported in tests without mocking window.location,
// so we test the queue algorithm in isolation here.

describe('refresh interceptor queue', () => {
  it('multiple concurrent 401s trigger only one refresh', async () => {
    type QueueItem = { resolve: (v: unknown) => void; reject: (e: unknown) => void }
    let isRefreshing = false
    let failedQueue: QueueItem[] = []

    function processQueue(error: unknown, token: string | null = null): void {
      failedQueue.forEach((p) => {
        if (error) p.reject(error)
        else p.resolve(token)
      })
      failedQueue = []
    }

    const refreshCalls: number[] = []

    async function handleUnauthorized(requestId: number): Promise<string> {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({
            resolve: (v) => resolve(v as string),
            reject,
          })
        })
      }
      isRefreshing = true
      refreshCalls.push(requestId)
      await Promise.resolve()
      const newToken = 'new-token'
      processQueue(null, newToken)
      isRefreshing = false
      return newToken
    }

    const results = await Promise.all([
      handleUnauthorized(1),
      handleUnauthorized(2),
      handleUnauthorized(3),
    ])

    expect(refreshCalls).toHaveLength(1)
    expect(results).toEqual(['new-token', 'new-token', 'new-token'])
  })

  it('processQueue rejects all waiting requests when refresh fails', async () => {
    type QueueItem = { resolve: (v: unknown) => void; reject: (e: unknown) => void }
    const failedQueue: QueueItem[] = []

    function processQueue(error: unknown, token: string | null = null): void {
      failedQueue.forEach((p) => {
        if (error) p.reject(error)
        else p.resolve(token)
      })
      failedQueue.length = 0
    }

    const rejections: string[] = []

    const p1 = new Promise<unknown>((resolve, reject) => {
      failedQueue.push({ resolve, reject })
    }).catch((e: unknown) => rejections.push(String(e)))

    const p2 = new Promise<unknown>((resolve, reject) => {
      failedQueue.push({ resolve, reject })
    }).catch((e: unknown) => rejections.push(String(e)))

    processQueue(new Error('refresh_failed'))
    await Promise.all([p1, p2])

    expect(rejections).toHaveLength(2)
    expect(rejections[0]).toContain('refresh_failed')
  })

  it('processQueue resolves all waiting requests with new token', async () => {
    type QueueItem = { resolve: (v: unknown) => void; reject: (e: unknown) => void }
    const failedQueue: QueueItem[] = []

    function processQueue(error: unknown, token: string | null = null): void {
      failedQueue.forEach((p) => {
        if (error) p.reject(error)
        else p.resolve(token)
      })
      failedQueue.length = 0
    }

    const tokens: unknown[] = []

    const p1 = new Promise<unknown>((resolve, reject) => {
      failedQueue.push({ resolve, reject })
    }).then((t) => tokens.push(t))

    const p2 = new Promise<unknown>((resolve, reject) => {
      failedQueue.push({ resolve, reject })
    }).then((t) => tokens.push(t))

    processQueue(null, 'refreshed-token')
    await Promise.all([p1, p2])

    expect(tokens).toHaveLength(2)
    expect(tokens[0]).toBe('refreshed-token')
    expect(tokens[1]).toBe('refreshed-token')
  })
})
