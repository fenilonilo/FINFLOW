import { describe, it, expect } from 'vitest'
import { formatMoney, parseMoney } from './currency'

describe('formatMoney', () => {
  it('formats BRL correctly', () => {
    expect(formatMoney('1234.56')).toBe('R$ 1.234,56')
  })
  it('handles zero', () => {
    expect(formatMoney('0.00')).toBe('R$ 0,00')
  })
  it('handles number input', () => {
    expect(formatMoney(500)).toBe('R$ 500,00')
  })
  it('handles negative values', () => {
    const result = formatMoney('-100.00')
    expect(result).toContain('100,00')
  })
})

describe('parseMoney', () => {
  it('returns decimal string from BRL formatted', () => {
    expect(parseMoney('R$ 1.234,56')).toBe('1234.56')
  })
  it('handles plain number string', () => {
    expect(parseMoney('1000.00')).toBe('1000.00')
  })
})
