import { expect, test } from 'vitest'
import { cmpMoney, pct, subMoney, sumMoney } from './money'

test('sumMoney is exact', () => {
  expect(sumMoney(['0.10', '0.20'])).toBe('0.30')
  expect(sumMoney([])).toBe('0.00')
  expect(sumMoney(['-12.50', '100'])).toBe('87.50')
  expect(sumMoney(['-0.05'])).toBe('-0.05')
})
test('subMoney', () => {
  expect(subMoney('10.00', '12.50')).toBe('-2.50')
  expect(subMoney('1', '1')).toBe('0.00')
})
test('cmpMoney', () => {
  expect(cmpMoney('1.5', '1.50')).toBe(0)
  expect(cmpMoney('1.49', '1.5')).toBe(-1)
  expect(cmpMoney('2', '1.99')).toBe(1)
})
test('pct handles zero whole', () => {
  expect(pct('50.00', '200.00')).toBe(25)
  expect(pct('1', '0')).toBe(0)
  expect(pct('1', '3')).toBe(33.3)
})
test('invalid money throws', () => expect(() => sumMoney(['abc'])).toThrow())
