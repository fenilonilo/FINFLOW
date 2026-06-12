const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** Mês da fatura (competência) de uma compra crédito. Espelha apps/cards/cycle.py. */
export function invoiceMonthLabel(closingDay: number, dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const closing = Math.min(closingDay, lastDay)
  const monthIndex = day <= closing ? month - 1 : month % 12
  return MONTHS[monthIndex]
}
