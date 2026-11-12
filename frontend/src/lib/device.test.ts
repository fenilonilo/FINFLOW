import { afterEach, expect, test, vi } from 'vitest'
import { deviceName, getDeviceName } from './device'

const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'

afterEach(() => { vi.unstubAllGlobals() })

test('deviceName', () => {
  expect(deviceName(WIN)).toBe('Chrome · Windows')
  expect(deviceName(IOS)).toBe('Safari · iOS')
  expect(deviceName(WIN.replace('Safari/537.36', 'Safari/537.36 Edg/130.0'))).toBe('Edge · Windows')
  expect(deviceName('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0')).toBe('Firefox · Linux')
  expect(deviceName('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe('Chrome · Android')
  expect(deviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15')).toBe('Safari · macOS')
  expect(deviceName('curl/8')).toMatch(/^Navegador · /)
  expect(deviceName('Chrome Windows ' + 'x'.repeat(200)).length).toBeLessThanOrEqual(80)
})
test('getDeviceName never throws when storage throws', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
  })
  expect(getDeviceName().length).toBeGreaterThan(0)
})
test('getDeviceName persists in ff_device', () => {
  const store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  })
  const n = getDeviceName()
  expect(store.ff_device).toBe(n)
  store.ff_device = 'Meu PC'
  expect(getDeviceName()).toBe('Meu PC')
})
