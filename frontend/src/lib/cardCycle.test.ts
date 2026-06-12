import { describe, expect, it } from 'vitest'
import { invoiceMonthLabel } from './cardCycle'

describe('invoiceMonthLabel', () => {
  it('compra após fechamento vai para o mês seguinte', () => {
    expect(invoiceMonthLabel(3, '2026-06-05')).toBe('julho')
  })
  it('compra até o fechamento fica no mês', () => {
    expect(invoiceMonthLabel(3, '2026-06-02')).toBe('junho')
  })
  it('vira o ano', () => {
    expect(invoiceMonthLabel(3, '2026-12-15')).toBe('janeiro')
  })
})
