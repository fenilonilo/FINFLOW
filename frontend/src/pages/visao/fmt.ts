// display only: whole-reais pt-BR, never used in math
export const brl0 = (v: string | number): string => 'R$ ' + Math.round(Number(v)).toLocaleString('pt-BR')
