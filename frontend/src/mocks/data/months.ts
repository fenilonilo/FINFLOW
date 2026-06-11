import type { MonthSummary } from '@/types/api'

export const mockSummary: MonthSummary = {
  year: 2025,
  month: 1,
  total_income: '11007.16',
  total_expense: '3283.06',
  total_fixed: '3283.06',
  total_variable: '0.00',
  total_invested: '5000.00',
  balance: '2724.10',
  pending_count: 1,
  investment_goal: '0.00',
  by_category: [
    {
      category_id: 1,
      category_name: 'Saúde',
      color: '#ef4444',
      total: '474.09',
      budget: '500.00',
      budget_used_pct: '94.82',
    },
  ],
  by_payment_method: [{ payment_method_id: 1, name: 'Pix', total: '3260.06' }],
}
