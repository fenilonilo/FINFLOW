export const TRANSACTION_TYPES = {
  income: 'Receita',
  expense: 'Despesa',
} as const

export const TRANSACTION_KINDS = {
  fixed: 'Fixo',
  variable: 'Variável',
} as const

export const RECURRING_STATUSES = {
  active: 'Ativo',
  paused: 'Pausado',
} as const

export const VERDICT_LABELS = {
  safe: 'Seguro',
  moderate: 'Moderado',
  risky: 'Arriscado',
  critical: 'Crítico',
} as const

export const VERDICT_COLORS = {
  safe: 'text-accent',
  moderate: 'text-warning',
  risky: 'text-danger',
  critical: 'text-danger',
} as const
