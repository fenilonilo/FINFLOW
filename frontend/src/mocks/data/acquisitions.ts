import type { SimulationResult } from '@/types/api'

const mockHealth = {
  avg_monthly_income: '8245.37',
  avg_monthly_expense: '3490.58',
  avg_monthly_invested: '2697.31',
  avg_balance: '2057.48',
  fixed_commitment_pct: '42.33',
  savings_rate_pct: '32.71',
  score: 78,
  score_label: 'Saudável',
}

export const mockSimulation: SimulationResult = {
  input: { name: 'Notebook Dell', total_value: '10000.00' },
  financed_amount: '8000.00',
  monthly_payment_first: '422.49',
  monthly_payment_last: '422.49',
  total_paid: '12139.76',
  total_interest: '2139.76',
  effective_cost_pct: '26.75',
  schedule: [
    {
      number: 1,
      due_date: '2026-07-01',
      amount: '422.49',
      interest_portion: '159.20',
      principal_portion: '263.29',
      remaining_balance: '7736.71',
    },
  ],
  impact: {
    baseline: mockHealth,
    projected: { ...mockHealth, score: 69, score_label: 'Saudável' },
    monthly_income_impact_pct: '5.12',
    balance_reduction_pct: '20.53',
    score_delta: -9,
    months_negative_balance: 0,
    opportunity_cost: '1893.40',
    timeline: [
      { year: 2026, month: 7, projected_balance: '1634.99', cumulative_paid: '422.49' },
    ],
    verdict: 'moderate',
    verdict_message: 'Compromete 5,1% da sua renda média por 24 meses.',
  },
}
