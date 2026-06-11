import { http, HttpResponse } from 'msw'

const BASE = '/api/v1'

const mockUser = { id: 1, email: 'felipe@finflow.app', first_name: 'Felipe' }

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

const mockSummary = {
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

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/token/`, () =>
    HttpResponse.json({ access: 'mock-access-token', refresh: 'mock-refresh-token' })
  ),
  http.post(`${BASE}/auth/token/refresh/`, () =>
    HttpResponse.json({ access: 'mock-access-token-2', refresh: 'mock-refresh-token-2' })
  ),
  http.get(`${BASE}/auth/me/`, () => HttpResponse.json(mockUser)),
  http.post(`${BASE}/auth/logout/`, () => new HttpResponse(null, { status: 205 })),

  // Month summary
  http.get(`${BASE}/months/:year/:month/summary/`, ({ params }) =>
    HttpResponse.json({
      ...mockSummary,
      year: Number(params.year),
      month: Number(params.month),
    })
  ),
  http.post(`${BASE}/months/:year/:month/generate-fixed/`, () =>
    HttpResponse.json({ created: 10, skipped: 0, completed_templates: [] })
  ),

  // Categories
  http.get(`${BASE}/categories/`, () =>
    HttpResponse.json({
      count: 3,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          name: 'Saúde',
          icon: 'heart-pulse',
          color: '#ef4444',
          parent: null,
          monthly_budget: '500.00',
          is_default: true,
          is_archived: false,
          transaction_count: 14,
        },
        {
          id: 2,
          name: 'Alimentação',
          icon: 'utensils',
          color: '#fb923c',
          parent: null,
          monthly_budget: null,
          is_default: true,
          is_archived: false,
          transaction_count: 5,
        },
        {
          id: 3,
          name: 'Lazer',
          icon: 'gamepad-2',
          color: '#818cf8',
          parent: null,
          monthly_budget: null,
          is_default: true,
          is_archived: false,
          transaction_count: 8,
        },
      ],
    })
  ),

  // Payment methods
  http.get(`${BASE}/payment-methods/`, () =>
    HttpResponse.json({
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          name: 'Pix',
          icon: 'zap',
          color: '#34d399',
          is_default: true,
          is_archived: false,
        },
        {
          id: 2,
          name: 'Cartão de Crédito',
          icon: 'credit-card',
          color: '#60a5fa',
          is_default: false,
          is_archived: false,
        },
      ],
    })
  ),

  // Transactions
  http.get(`${BASE}/transactions/`, () =>
    HttpResponse.json({
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          type: 'expense',
          kind: 'fixed',
          category: 1,
          category_detail: { id: 1, name: 'Saúde', icon: 'heart-pulse', color: '#ef4444' },
          description: 'Unimed',
          amount: '416.09',
          date: '2025-01-12',
          year: 2025,
          month: 1,
          payment_method: 1,
          payment_method_detail: { id: 1, name: 'Pix', icon: 'zap', color: '#34d399' },
          is_paid: true,
          recurring_source: 1,
          installment_current: null,
          installment_total: null,
        },
        {
          id: 2,
          type: 'income',
          kind: 'variable',
          category: null,
          category_detail: null,
          description: 'Salário',
          amount: '8000.00',
          date: '2025-01-10',
          year: 2025,
          month: 1,
          payment_method: 1,
          payment_method_detail: { id: 1, name: 'Pix', icon: 'zap', color: '#34d399' },
          is_paid: true,
          recurring_source: null,
          installment_current: null,
          installment_total: null,
        },
      ],
    })
  ),
  http.post(`${BASE}/transactions/`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: 99, ...(body as object) }, { status: 201 })
  }),
  http.patch(`${BASE}/transactions/:id/`, async ({ params, request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: Number(params.id), ...(body as object) })
  }),
  http.delete(`${BASE}/transactions/:id/`, () => new HttpResponse(null, { status: 204 })),

  // Recurring expenses
  http.get(`${BASE}/recurring-expenses/`, () =>
    HttpResponse.json({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          description: 'Unimed',
          category: 1,
          category_detail: { id: 1, name: 'Saúde', icon: 'heart-pulse', color: '#ef4444' },
          payment_method: 1,
          payment_method_detail: { id: 1, name: 'Pix', icon: 'zap', color: '#34d399' },
          default_amount: '416.09',
          due_day: 12,
          status: 'active',
          total_occurrences: null,
          generated_count: 6,
          acquisition: null,
        },
      ],
    })
  ),

  // Investments
  http.get(`${BASE}/investments/`, () =>
    HttpResponse.json({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          year: 2025,
          month: 1,
          date: '2025-01-15',
          location: 'Tesouro Direto',
          amount: '5000.00',
        },
      ],
    })
  ),
  http.post(`${BASE}/investments/`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: 99, ...(body as object) }, { status: 201 })
  }),
  http.delete(`${BASE}/investments/:id/`, () => new HttpResponse(null, { status: 204 })),

  // Cards
  http.get(`${BASE}/cards/`, () =>
    HttpResponse.json({
      count: 1,
      next: null,
      previous: null,
      results: [
        { id: 1, name: 'Nubank', color: '#818cf8', closing_day: 3, due_day: 10 },
      ],
    })
  ),
  http.get(`${BASE}/cards/invoices/`, () =>
    HttpResponse.json({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          card: 1,
          year: 2025,
          month: 1,
          amount: '1234.56',
          due_date: '2025-01-10',
          is_paid: false,
        },
      ],
    })
  ),

  // Debts
  http.get(`${BASE}/debts/`, () =>
    HttpResponse.json({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          debt_type: 'financing',
          creditor: 'Banco do Brasil',
          payment_method: 1,
          installment_current: 6,
          installment_total: 24,
          installment_amount: '422.49',
          total_amount: '10000.00',
          start_date: '2024-07-01',
          is_settled: false,
        },
      ],
    })
  ),

  // Analytics
  http.get(`${BASE}/analytics/health-score/`, () => HttpResponse.json(mockHealth)),
  http.get(`${BASE}/analytics/yearly/`, ({ request }) => {
    const url = new URL(request.url)
    const year = Number(url.searchParams.get('year') ?? 2025)
    return HttpResponse.json({
      year,
      months: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        total_income: '8000.00',
        total_expense: '3500.00',
        total_invested: '2000.00',
        balance: '2500.00',
      })),
    })
  }),

  // Acquisitions
  http.get(`${BASE}/acquisitions/`, () =>
    HttpResponse.json({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })
  ),
  http.post(`${BASE}/acquisitions/`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: 1, ...(body as object) }, { status: 201 })
  }),
  http.delete(`${BASE}/acquisitions/:id/`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${BASE}/acquisitions/simulate/`, () =>
    HttpResponse.json({
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
        {
          number: 2,
          due_date: '2026-08-01',
          amount: '422.49',
          interest_portion: '142.30',
          principal_portion: '280.19',
          remaining_balance: '7456.52',
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
          { year: 2026, month: 8, projected_balance: '1212.50', cumulative_paid: '844.98' },
          { year: 2026, month: 9, projected_balance: '789.99', cumulative_paid: '1267.47' },
        ],
        verdict: 'moderate',
        verdict_message: 'Compromete 5,1% da sua renda média por 24 meses.',
      },
    })
  ),

  // Recurring expenses CRUD
  http.post(`${BASE}/recurring-expenses/`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: 99, ...(body as object) }, { status: 201 })
  }),
  http.patch(`${BASE}/recurring-expenses/:id/`, async ({ params, request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: Number(params.id), ...(body as object) })
  }),

  // Cards CRUD
  http.post(`${BASE}/cards/`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: 99, ...(body as object) }, { status: 201 })
  }),
  http.patch(`${BASE}/cards/:id/`, async ({ params, request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: Number(params.id), ...(body as object) })
  }),
  http.delete(`${BASE}/cards/:id/`, () => new HttpResponse(null, { status: 204 })),
  http.patch(`${BASE}/cards/invoices/:id/`, async ({ params, request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: Number(params.id), ...(body as object) })
  }),

  // Debts
  http.post(`${BASE}/debts/:id/advance/`, ({ params }) =>
    HttpResponse.json({ id: Number(params.id), installment_current: 7 })
  ),

  // Categories CRUD
  http.post(`${BASE}/categories/`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: 99, ...(body as object), transaction_count: 0 }, { status: 201 })
  }),
  http.patch(`${BASE}/categories/:id/`, async ({ params, request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: Number(params.id), ...(body as object) })
  }),

  // Payment methods CRUD
  http.post(`${BASE}/payment-methods/`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: 99, ...(body as object) }, { status: 201 })
  }),
  http.patch(`${BASE}/payment-methods/:id/`, async ({ params, request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: Number(params.id), ...(body as object) })
  }),

  // Auth sessions
  http.get(`${BASE}/auth/sessions/`, () =>
    HttpResponse.json([
      {
        id: 'session-1',
        device: 'Chrome no Windows — Felipe',
        last_seen: new Date().toISOString(),
        is_current: true,
      },
      {
        id: 'session-2',
        device: 'Safari no iPhone',
        last_seen: new Date(Date.now() - 86400000).toISOString(),
        is_current: false,
      },
    ])
  ),
  http.delete(`${BASE}/auth/sessions/:id/`, () => new HttpResponse(null, { status: 204 })),

  // Analytics extras
  http.get(`${BASE}/analytics/heatmap/`, ({ request }) => {
    const url = new URL(request.url)
    const year = Number(url.searchParams.get('year') ?? new Date().getFullYear())
    // generate sparse heatmap data
    const entries = []
    for (let d = 1; d <= 365; d += 7) {
      const date = new Date(year, 0, d)
      if (date.getFullYear() !== year) break
      entries.push({
        date: date.toISOString().slice(0, 10),
        total: (Math.random() * 500).toFixed(2),
      })
    }
    return HttpResponse.json(entries)
  }),
  http.get(`${BASE}/analytics/category-trends/`, () =>
    HttpResponse.json([
      {
        category_name: 'Saúde',
        color: '#ef4444',
        months: [
          { month: 1, year: 2025, total: '474.09' },
          { month: 2, year: 2025, total: '420.00' },
          { month: 3, year: 2025, total: '510.00' },
        ],
      },
      {
        category_name: 'Alimentação',
        color: '#fb923c',
        months: [
          { month: 1, year: 2025, total: '850.00' },
          { month: 2, year: 2025, total: '780.00' },
          { month: 3, year: 2025, total: '900.00' },
        ],
      },
    ])
  ),
  http.get(`${BASE}/analytics/top-categories/`, () =>
    HttpResponse.json([
      { category_name: 'Alimentação', color: '#fb923c', total: '2800.00' },
      { category_name: 'Saúde', color: '#ef4444', total: '1900.00' },
      { category_name: 'Lazer', color: '#818cf8', total: '1200.00' },
      { category_name: 'Transporte', color: '#60a5fa', total: '950.00' },
    ])
  ),
]
