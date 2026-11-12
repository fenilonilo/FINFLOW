import { usePeriod } from '@/contexts/PeriodContext'
import { monthLabel } from '@/lib/date'

export default function MonthNav() {
  const { year, month, setPeriod } = usePeriod()
  const go = (d: number) => {
    const i = year * 12 + (month - 1) + d
    setPeriod(Math.floor(i / 12), (i % 12) + 1)
  }
  const btn = 'h-[30px] w-[30px] rounded-full text-mu hover:bg-white/5 hover:text-tx'
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/[.07] bg-white/[.02] p-1 text-[13px] font-medium">
      <button type="button" aria-label="Mês anterior" className={btn} onClick={() => go(-1)}>‹</button>
      <span className="px-2.5">{monthLabel(month)} {year}</span>
      <button type="button" aria-label="Próximo mês" className={btn} onClick={() => go(1)}>›</button>
    </div>
  )
}
