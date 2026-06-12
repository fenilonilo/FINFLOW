// Manual types mirroring section 6 of FINFLOW_PLANO_IMPLEMENTACAO_v2.md
// DO NOT diverge from the section 6 contracts — these are frozen inter-agent interfaces.
// Last regenerated: 2026-06-12 — fields updated from OpenAPI schema for cards integration.

export interface User {
  id: number
  email: string
  first_name: string
}

export interface Category {
  id: number
  name: string
  icon: string
  color: string
  parent: number | null
  monthly_budget: string | null
  is_default: boolean
  is_archived: boolean
  transaction_count: number
}

export interface PaymentMethod {
  id: number
  name: string
  icon: string
  color: string
  is_default: boolean
  is_archived: boolean
  card_function: 'credit' | 'debit' | null
  card_detail: {
    id: number
    name: string
    color: string
    closing_day: number
  } | null
}

export interface Transaction {
  id: number
  type: 'income' | 'expense'
  kind: 'fixed' | 'variable'
  category: number | null
  category_detail: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null
  description: string
  amount: string
  date: string
  year: number
  month: number
  payment_method: number | null
  payment_method_detail: Pick<PaymentMethod, 'id' | 'name' | 'icon' | 'color'> | null
  is_paid: boolean
  recurring_source: number | null
  installment_current: number | null
  installment_total: number | null
  installments?: number
}

export interface RecurringExpense {
  id: number
  description: string
  is_variable: boolean
  category: number | null
  category_detail: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null
  payment_method: number | null
  payment_method_detail: Pick<PaymentMethod, 'id' | 'name' | 'icon' | 'color'> | null
  default_amount: string | null
  due_day: number
  status: 'active' | 'paused'
  total_occurrences: number | null
  generated_count: number
  acquisition: number | null
}

export interface PendingVariable {
  id: number
  description: string
  suggested_amount: string | null
  category_id: number | null
  payment_method_id: number | null
  due_day: number
}

export interface GenerateFixedResult {
  created: number
  skipped: number
  completed_templates: number[]
  pending_variables: PendingVariable[]
}

export interface MonthSummary {
  year: number
  month: number
  total_income: string
  total_expense: string
  total_fixed: string
  total_variable: string
  total_invested: string
  balance: string
  pending_count: number
  investment_goal: string
  by_category: Array<{
    category_id: number
    category_name: string
    color: string
    total: string
    budget: string
    budget_used_pct: string
  }>
  by_payment_method: Array<{
    payment_method_id: number
    name: string
    total: string
  }>
}

export interface FinancialHealth {
  avg_monthly_income: string
  avg_monthly_expense: string
  avg_monthly_invested: string
  avg_balance: string
  fixed_commitment_pct: string
  savings_rate_pct: string
  score: number
  score_label: string
}

export interface Installment {
  number: number
  due_date: string
  amount: string
  interest_portion: string
  principal_portion: string
  remaining_balance: string
}

export interface SimulationResult {
  input: Record<string, unknown>
  financed_amount: string
  monthly_payment_first: string
  monthly_payment_last: string
  total_paid: string
  total_interest: string
  effective_cost_pct: string
  schedule: Installment[]
  impact: {
    baseline: FinancialHealth
    projected: FinancialHealth
    monthly_income_impact_pct: string
    balance_reduction_pct: string
    score_delta: number
    months_negative_balance: number
    opportunity_cost: string
    timeline: Array<{
      year: number
      month: number
      projected_balance: string
      cumulative_paid: string
    }>
    verdict: 'safe' | 'moderate' | 'risky' | 'critical'
    verdict_message: string
  }
}

export interface Investment {
  id: number
  year: number
  month: number
  date: string
  location: string
  amount: string
}

export interface Card {
  id: number
  name: string
  color: string
  closing_day: number
  due_day: number
  limit: string | null
  functions: Array<'credit' | 'debit'>
  active_functions: string
}

export interface CardInvoice {
  id: number
  card: number
  year: number
  month: number
  amount: string
  due_date: string
  is_paid: boolean
}

export interface InvoiceSummary {
  amount: string
  snapshot_amount: string | null
  is_paid: boolean
  divergent: boolean
  cycle_start: string
  cycle_end: string
  due_date: string
}

export interface CardSummary {
  card_id: number
  name: string
  color: string
  closing_day: number
  due_day: number
  functions: Array<'credit' | 'debit'>
  limit: string | null
  committed: string
  committed_pct: string | null
  open_cycle_spend: string
  invoice: InvoiceSummary
}

export interface Debt {
  id: number
  debt_type: string
  creditor: string
  payment_method: number | null
  installment_current: number
  installment_total: number
  installment_amount: string
  total_amount: string
  start_date: string
  is_settled: boolean
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
