import { http, HttpResponse } from 'msw'

const BASE = '/api/v1'

const mockUser = { id: 1, email: 'felipe@finflow.app', first_name: 'Felipe', avatar_url: null }

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

  // Cards
  http.get(`${BASE}/cards/`, () =>
    HttpResponse.json({
      count: 1,
      next: null,
      previous: null,
      results: [
        { id: 1, name: 'Nubank', color: '#820AD1', bank: 'nubank', is_active: true, closing_day: 3, due_day: 10, limit: null, active_functions: ['credit', 'debit'] },
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
        id: 1,
        device_name: 'Chrome · Windows',
        last_seen_at: new Date().toISOString(),
        created_at: '2026-11-01T10:00:00Z',
        revoked: false,
        is_current: true,
      },
      {
        id: 2,
        device_name: 'Safari · iOS',
        last_seen_at: new Date(Date.now() - 86400000).toISOString(),
        created_at: '2026-10-20T08:30:00Z',
        revoked: false,
        is_current: false,
      },
    ])
  ),
  http.delete(`${BASE}/auth/sessions/:id/`, () => new HttpResponse(null, { status: 204 })),

  // Account
  http.patch(`${BASE}/auth/me/`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ ...mockUser, ...(body as object) })
  }),
  http.post(`${BASE}/auth/me/avatar/`, () =>
    HttpResponse.json({ ...mockUser, avatar_url: '/media/avatars/mock.png' })
  ),
  http.delete(`${BASE}/auth/me/avatar/`, () => new HttpResponse(null, { status: 204 })),

  // Cards summary / invoices
  http.get(`${BASE}/cards/summary/`, () => {
    const invoice = {
      amount: '0.00',
      snapshot_amount: null,
      is_paid: false,
      divergent: false,
      cycle_start: '2026-10-04',
      cycle_end: '2026-11-03',
      due_date: '2026-11-10',
    }
    const base = { is_active: true, closing_day: 3, due_day: 10, open_cycle_spend: '0.00' }
    return HttpResponse.json([
      {
        ...base, card_id: 1, name: 'Nubank', color: '#820AD1', bank: 'nubank',
        functions: ['credit', 'debit'], limit: '5000.00', committed: '1234.56', committed_pct: '24.69',
        open_cycle_spend: '300.00', invoice: { ...invoice, amount: '1234.56', snapshot_amount: '1234.56' },
      },
      {
        ...base, card_id: 2, name: 'Inter', color: '#FF7A00', bank: 'inter',
        functions: ['credit'], limit: null, committed: '800.00', committed_pct: null,
        invoice: { ...invoice, amount: '800.00', is_paid: true },
      },
      {
        ...base, card_id: 3, name: 'Itaú Débito', color: '#EC7000', bank: 'itau',
        functions: ['debit'], limit: null, committed: '0.00', committed_pct: null, invoice,
      },
    ])
  }),
  http.post(`${BASE}/cards/:id/pay-invoice/`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(body as object)
  }),

  // Imports
  http.post(`${BASE}/imports/statement/`, () =>
    HttpResponse.json(
      {
        created: 1,
        skipped: 3,
        total: '189.90',
        items: [
          { index: 0, date: '2026-11-02', description: 'Mercado Livre', amount: '189.90', category: 'Lazer', category_id: 3, status: 'created' },
          { index: 1, date: '2026-11-03', description: 'Padaria Central', amount: '23.50', category: 'Alimentação', category_id: 2, status: 'duplicate' },
          { index: 2, date: '2026-11-04', description: 'Estorno Loja X', amount: '59.90', category: null, category_id: null, status: 'refunded' },
          { index: 3, date: '2026-11-05', description: 'Pagamento fatura', amount: '1000.00', category: null, category_id: null, status: 'ignored' },
        ],
      },
      { status: 200 }
    )
  ),
  http.get(`${BASE}/imports/`, () =>
    HttpResponse.json([
      {
        id: 2, card_id: 1, card_name: 'Nubank', card_bank: 'nubank', kind: 'credit', year: 2026, month: 11,
        filename: 'Nubank_2026-11-12.csv', created_count: 42, skipped_count: 3, total: '1234.56',
        created_at: '2026-11-12T12:00:00Z',
      },
      {
        id: 1, card_id: 2, card_name: 'Inter', card_bank: 'inter', kind: 'credit', year: 2026, month: 10,
        filename: 'fatura-inter-2026-10.pdf', created_count: 18, skipped_count: 0, total: '800.00',
        created_at: '2026-10-12T12:00:00Z',
      },
    ])
  ),

  // Generate variables
  http.post(`${BASE}/months/:year/:month/generate-variables/`, () =>
    HttpResponse.json({ created: 1, skipped: 0 })
  ),
]
