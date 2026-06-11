import { describe, it, expect } from 'vitest'
import { monthLabel, monthLabelFull, formatDate } from './date'

describe('monthLabel', () => {
  it('returns Jan for month 1', () => expect(monthLabel(1)).toBe('Jan'))
  it('returns Dez for month 12', () => expect(monthLabel(12)).toBe('Dez'))
  it('returns Jun for month 6', () => expect(monthLabel(6)).toBe('Jun'))
  it('returns empty string for out-of-range', () => expect(monthLabel(13)).toBe(''))
})

describe('monthLabelFull', () => {
  it('returns Janeiro for month 1', () => expect(monthLabelFull(1)).toBe('Janeiro'))
  it('returns Dezembro for month 12', () => expect(monthLabelFull(12)).toBe('Dezembro'))
  it('returns Junho for month 6', () => expect(monthLabelFull(6)).toBe('Junho'))
})

describe('formatDate', () => {
  it('formats YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(formatDate('2025-01-15')).toBe('15/01/2025')
  })
  it('formats correctly for december', () => {
    expect(formatDate('2025-12-31')).toBe('31/12/2025')
  })
})
