import { formatMoney } from '@/lib/currency'

interface MoneyTextProps {
  value: string | number
  className?: string
  positive?: boolean
}

export default function MoneyText({ value, className = '', positive }: MoneyTextProps) {
  const colorClass =
    positive === true ? 'text-accent' : positive === false ? 'text-danger' : ''
  return (
    <span className={`tabular-nums ${colorClass} ${className}`}>{formatMoney(value)}</span>
  )
}
