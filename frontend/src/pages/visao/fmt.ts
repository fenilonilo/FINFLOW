// display only: whole-reais pt-BR, never used in math
export const brl0 = (v: string | number): string => {
  const n = Math.round(Number(v))
  return `${n < 0 ? '-' : ''}R$ ${Math.abs(n).toLocaleString('pt-BR')}`
}
