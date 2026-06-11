// TODO: regenerate via `npm run gen:types` once backend is running at localhost:8000
// Manual types mirroring section 6 of FINFLOW_PLANO_IMPLEMENTACAO_v2.md
// DO NOT diverge from the section 6 contracts — these are frozen inter-agent interfaces.

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
}

export interface RecurringExpense {
  id: number
  description: string
  category: number | null
  category_detail: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null
  payment_method: number | null
  payment_method_detail: Pick<PaymentMethod, 'id' | 'name' | 'icon' | 'color'> | null
  default_amount: string
  due_day: number
  status: 'active' | 'paused'
  total_occurrences: number | null
  generated_count: number
  acquisition: number | null
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
