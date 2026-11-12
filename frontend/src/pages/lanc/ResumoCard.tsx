import { formatMoney } from '@/lib/currency'
import { cmpMoney, pct } from '@/lib/money'
import type { MonthSummary } from '@/types/models'

export default function ResumoCard({ s }: { s: MonthSummary }) {
  const max = cmpMoney(s.total_income, s.total_expense) >= 0 ? s.total_income : s.total_expense
  const w = (v: string) => `${Math.min(100, Math.max(0, pct(v, max)))}%`
  const neg = cmpMoney(s.balance, '0') < 0
  const rows = [
    { l: 'Entradas', v: formatMoney(s.total_income), w: w(s.total_income), c: 'var(--g2, #3f9a50)' },
    { l: 'Saídas', v: formatMoney(s.total_expense), w: w(s.total_expense), c: '#5b8fc7' },
    { l: 'Sobra', v: `${neg ? '' : '+ '}${formatMoney(s.balance)}`, w: w(s.balance), c: neg ? '#e06060' : 'var(--g)' },
  ]
  return (
    <div className="glass rise">
      <div className="card-h"><h3>Resumo do mês</h3><span className="muted" style={{ fontSize: 12 }}>até hoje</span></div>
      <div className="resumo">
        {rows.map((r) => (
          <div className="rr" key={r.l}>
            <span className="eyebrow plain">{r.l}</span>
            <span className="v" style={r.l === 'Sobra' ? { color: r.c } : undefined}>{r.v}</span>
            <div className="rb"><b style={{ width: r.w, background: r.c }} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}
