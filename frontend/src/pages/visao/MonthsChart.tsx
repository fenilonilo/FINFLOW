import { useState } from 'react'
import { monthLabel, monthLabelFull } from '@/lib/date'
import { sumMoney } from '@/lib/money'
import type { MonthPoint } from '@/lib/overview'
import { brl0 } from './fmt'

const W = 1200, H = 330, PL = 40, PB = 28, PT = 14
export const keyOf = (p: { year: number; month: number }) => `${p.year}-${p.month}`
const top4 = (x: number, y: number, w: number, h: number) => `M${x},${y + h}V${y + 4}q0,-4 4,-4h${w - 8}q4,0 4,4V${y + h}Z`

export default function MonthsChart({ points, selected, onSelect }: { points: MonthPoint[]; selected: string; onSelect: (k: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const totals = points.map(p => Number(sumMoney([p.fixed, p.variable])))
  const incomes = points.map(p => Number(p.income))
  const income = incomes[incomes.length - 1] ?? 0
  const step = Math.max(1000, Math.ceil(Math.max(...totals, ...incomes, 1) / 3 / 1000) * 1000)
  const maxV = step * 3 + step / 3
  const yv = (v: number) => PT + (H - PB - PT) * (1 - v / maxV)
  const slot = (W - PL) / Math.max(points.length, 1)
  const bw = Math.min(46, slot * 0.56)
  const hi = points.findIndex(p => keyOf(p) === hover)
  const hp = points[hi]

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gastos mensais, fixos e variáveis">
        <defs>
          <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" fill="rgba(126,224,138,.55)" /></pattern>
        </defs>
        {[0, 1, 2, 3].map(k => (
          <g key={k}><line className="gl" x1={PL} x2={W} y1={yv(k * step)} y2={yv(k * step)} /><text className="gt" x={0} y={yv(k * step) + 3}>{k ? `${(k * step) / 1000}k` : '0'}</text></g>
        ))}
        {points.map((p, i) => {
          const k = keyOf(p), cx = PL + slot * i + slot / 2, x = cx - bw / 2
          const base = yv(0), yF = yv(Number(p.fixed)), yT = yv(totals[i])
          return (
            <g key={k} className={`col${k === selected ? ' on' : ''}`} data-month={k} data-projected={p.projected ? 'true' : undefined}
              role="button" tabIndex={0} aria-label={`${monthLabelFull(p.month)} ${p.year}${p.projected ? ' (projeção)' : ''}: total ${brl0(sumMoney([p.fixed, p.variable]))}`}
              onClick={() => onSelect(k)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(k) } }} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}>
              <rect x={cx - slot / 2} y={0} width={slot} height={H} fill="transparent" />
              {p.projected ? (
                <path className="seg" d={top4(x, yT, bw, base - yT)} fill="url(#hatch)" stroke="rgba(126,224,138,.5)" strokeDasharray="3 3" />
              ) : (
                <>
                  <rect className="seg" x={x} y={yF} width={bw} height={Math.max(base - yF, 0)} fill="#5b8fc7" />
                  <path className="seg" d={top4(x, yT, bw, Math.max(yF - 2 - yT, 0))} fill="#3f9a50" />
                </>
              )}
              <text className="lbl" x={cx} y={H - 8}>{monthLabel(p.month).toLowerCase()}{p.month === 1 || i === 0 ? `·${String(p.year).slice(2)}` : ''}</text>
            </g>
          )
        })}
        <path d={incomes.map((v, i) => `${i ? `V${yv(v)}` : `M${PL},${yv(v)}`}H${PL + slot * (i + 1)}`).join("")} fill="none" stroke="#86a08a" strokeWidth={1.5} strokeDasharray="4 4" />
        <text className="gt" x={W} y={yv(income) - 7} textAnchor="end">receita {brl0(income)}</text>
      </svg>
      {hp && (
        <div className="tip" style={{ opacity: 1, left: `${((PL + slot * hi + slot / 2) / W) * 100}%`, top: `${(yv(totals[hi]) / H) * 100}%` }}>
          <b>{monthLabelFull(hp.month)}{hp.projected ? ' · projeção' : ''}</b>
          <div className="r"><span>Fixos</span><span>{brl0(hp.fixed)}</span></div>
          <div className="r"><span>Variáveis</span><span>{brl0(hp.variable)}</span></div>
          <div className="r"><span>Total</span><span>{brl0(sumMoney([hp.fixed, hp.variable]))}</span></div>
        </div>
      )}
      <table className="sr-only">
        <caption>Fixos, variáveis e total por mês</caption>
        <thead><tr><th>Mês</th><th>Fixos</th><th>Variáveis</th><th>Total</th></tr></thead>
        <tbody>
          {points.map(p => (
            <tr key={keyOf(p)}><th scope="row">{monthLabelFull(p.month)} {p.year}{p.projected ? ' (projeção)' : ''}</th><td>{brl0(p.fixed)}</td><td>{brl0(p.variable)}</td><td>{brl0(sumMoney([p.fixed, p.variable]))}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
