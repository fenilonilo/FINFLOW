import { useMemo, useState } from 'react'
import { useCardsSummary } from '@/api/cards'
import { useRecurring } from '@/api/catalog'
import { useMonthSummaries } from '@/api/months'
import Skeleton from '@/components/ui/Skeleton'
import { usePeriod } from '@/contexts/PeriodContext'
import { monthLabelFull } from '@/lib/date'
import { avgMoney, cmpMoney, pct, subMoney, sumMoney } from '@/lib/money'
import { buildSeries, headline, projectNext } from '@/lib/overview'
import type { MonthSummary } from '@/types/models'
import { brl0 } from './fmt'
import MonthsChart, { keyOf } from './MonthsChart'

const lower = (m: number) => monthLabelFull(m).toLowerCase()

function last12(year: number, month: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const t = year * 12 + (month - 1) - (11 - i)
    return { year: Math.floor(t / 12), month: (t % 12) + 1 }
  })
}

export default function Visao() {
  const { year, month } = usePeriod()
  const queries = useMonthSummaries(useMemo(() => last12(year, month), [year, month]))
  const recurring = useRecurring()
  const [sel, setSel] = useState<string | null>(null)

  const summaries = queries.map(q => q.data).filter((d): d is MonthSummary => !!d)
  const series = buildSeries(summaries)
  const fixedTotal = sumMoney(
    (recurring.data?.results ?? []).filter(r => r.status === 'active' && r.type === 'expense').map(r => r.default_amount ?? '0'),
  )
  const projected = recurring.isSuccess ? projectNext(series, fixedTotal) : null
  const points = projected ? [...series, projected] : series
  const point = points.find(p => keyOf(p) === sel) ?? series[series.length - 1]
  const idx = point ? points.indexOf(point) : -1
  const prev = idx > 0 ? points[idx - 1] : undefined
  const cards = useCardsSummary(point?.year ?? year, point?.month ?? month)

  const loading = queries.some(q => q.isLoading)
  const h = point ? headline(point, prev) : null
  const summary = point && !point.projected ? summaries.find(s => s.year === point.year && s.month === point.month) : undefined
  const cats = [...(summary?.by_category ?? [])].filter(c => cmpMoney(c.total, '0') > 0).sort((a, b) => cmpMoney(b.total, a.total))
  const maxCat = cats[0]?.total ?? '0'
  const total = point ? sumMoney([point.fixed, point.variable]) : '0.00'
  const pf = point ? pct(point.fixed, total) : 0
  const past = points.slice(Math.max(0, idx - 6), idx).filter(p => !p.projected)
  const avg = past.length ? avgMoney(past.map(p => p.variable)) : null
  const dv = point && avg && cmpMoney(avg, '0') > 0 ? pct(subMoney(point.variable, avg), avg) : null

  return (
    <div className="vis-page">
      <div className="eyebrow rise">Visão · últimos 12 meses</div>
      {loading ? <Skeleton className="h-96" /> : !point || !h ? (
        <p className="glass muted">Sem dados para exibir.</p>
      ) : (
        <>
          <div className="sentence" aria-live="polite"><div key={keyOf(point)}>
            {point.projected ? (
              <>{monthLabelFull(point.month)} deve fechar perto de <em>{brl0(h.spent)}</em></>
            ) : (
              <>
                {monthLabelFull(point.month)} custou <em>{brl0(h.spent)}</em>{' '}
                {prev && h.deltaPct != null && <span className="soft">— {Math.round(Math.abs(h.deltaPct))}% {h.deltaPct < 0 ? 'a menos' : 'a mais'} que {lower(prev.month)}.</span>}{' '}
                Sobraram <em>{brl0(h.left)}</em>.
              </>
            )}
          </div></div>
          <div className="glass" style={{ paddingBottom: 12 }}>
            <div className="legend">
              <span><i style={{ background: 'var(--blue)' }} />Fixos</span>
              <span><i style={{ background: 'var(--g2)' }} />Variáveis</span>
              <span><i style={{ background: 'repeating-linear-gradient(45deg,rgba(126,224,138,.5) 0 2px,transparent 2px 5px)', border: '1px solid rgba(126,224,138,.4)' }} />Projeção</span>
              <span><i style={{ height: 0, borderTop: '1.5px dashed var(--mu)', borderRadius: 0, width: 14 }} />Receita</span>
            </div>
            <MonthsChart points={points} selected={keyOf(point)} onSelect={setSel} />
          </div>
          <div className="ins">
            <div className="glass">
              <h4>Onde foi o variável</h4>
              {cats.length ? cats.map(c => (
                <div className="hb" key={c.category_id}>
                  <span>{c.category_name}</span>
                  <div className="bar" style={{ width: `${Math.min(100, (pct(c.total, maxCat) / 125) * 100)}%` }} />
                  <span className="num">{brl0(c.total)}</span>
                </div>
              )) : <p className="muted">Sem dados por categoria.</p>}
            </div>
            <div className="glass">
              <h4>Fixos × variáveis</h4>
              <div className="split"><b style={{ flexGrow: pf, background: '#5b8fc7' }} /><b style={{ flexGrow: 100 - pf, background: '#3f9a50' }} /></div>
              <div className="kv"><span><i style={{ background: '#5b8fc7' }} />Fixos</span><span className="num">{brl0(point.fixed)} · {Math.round(pf)}%</span></div>
              <div className="kv"><span><i style={{ background: '#3f9a50' }} />Variáveis</span><span className="num">{brl0(point.variable)} · {Math.round(100 - pf)}%</span></div>
            </div>
            <div className="glass">
              <h4>Destaque</h4>
              <div className="hl">
                {!past.length ? 'Primeiro mês do histórico.' : dv == null ? null : <>Variáveis <em>{dv >= 0 ? '+' : ''}{Math.round(dv)}%</em> contra a média dos últimos 6 meses.</>}
              </div>
              <div style={{ marginTop: 14 }}>
                {(cards.data ?? []).filter(c => cmpMoney(c.invoice.amount, '0') > 0).map(c => (
                  <div className="kv" key={c.card_id}><span><i style={{ background: c.color }} />Fatura {c.name}</span><span className="num">{brl0(c.invoice.amount)}</span></div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
