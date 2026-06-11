import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePeriod } from '@/contexts/PeriodContext'
import { monthLabelFull } from '@/lib/date'

export default function MonthPicker() {
  const { year, month, setPeriod } = usePeriod()

  function prev() {
    if (month === 1) setPeriod(year - 1, 12)
    else setPeriod(year, month - 1)
  }

  function next() {
    if (month === 12) setPeriod(year + 1, 1)
    else setPeriod(year, month + 1)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={prev}
        className="rounded-lg p-1.5 hover:bg-elevated transition-colors"
        aria-label="Mês anterior"
      >
        <ChevronLeft size={16} className="text-text-muted" />
      </button>
      <span className="min-w-36 text-center text-sm font-medium text-text-primary">
        {monthLabelFull(month)} {year}
      </span>
      <button
        onClick={next}
        className="rounded-lg p-1.5 hover:bg-elevated transition-colors"
        aria-label="Próximo mês"
      >
        <ChevronRight size={16} className="text-text-muted" />
      </button>
    </div>
  )
}
