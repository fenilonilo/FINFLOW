export function formatMoney(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num)
}

export function parseMoney(value: string): string {
  // Returns clean decimal string "1234.56"
  // Handle pt-BR format: "R$ 1.234,56" → "1234.56"
  // Step 1: remove currency symbol and spaces
  const stripped = value.replace(/[^\d,.]/g, '')
  // Step 2: if comma is the decimal separator (pt-BR), remove dots (thousands sep) and swap comma
  if (stripped.includes(',')) {
    return parseFloat(stripped.replace(/\./g, '').replace(',', '.')).toFixed(2)
  }
  // Step 3: plain decimal string
  return parseFloat(stripped).toFixed(2)
}
