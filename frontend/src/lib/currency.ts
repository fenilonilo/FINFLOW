export function formatMoney(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num)
}

export function parseMoney(value: string): string {
  // pt-BR "R$ 1.234,56", "1.234" (milhar), ou decimal simples "1234.5" -> "1234.56". Sem float.
  const s = value.replace(/[^\d,.]/g, '')
  let int: string
  let frac = ''
  const comma = s.lastIndexOf(',')
  if (comma >= 0) {
    int = s.slice(0, comma).replace(/\./g, '')
    frac = s.slice(comma + 1).replace(/\./g, '')
  } else {
    const dot = s.lastIndexOf('.')
    const after = s.length - dot - 1
    if (dot >= 0 && (s.indexOf('.') === dot ? after !== 3 : false)) {
      int = s.slice(0, dot)
      frac = s.slice(dot + 1)
    } else int = s.replace(/\./g, '')
  }
  return `${int.replace(/^0+(?=\d)/, '') || '0'}.${frac.slice(0, 2).padEnd(2, '0')}`
}
