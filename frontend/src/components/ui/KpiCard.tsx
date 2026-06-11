import { type ReactNode } from 'react'
import { useCountUp } from '@/lib/useCountUp'
import { formatMoney } from '@/lib/currency'

interface KpiCardProps {
  title: string
  value: string
  rawValue?: number
  subtitle?: string
  icon?: ReactNode
  variant?: 'default' | 'positive' | 'negative' | 'warning'
  animate?: boolean
}

const variants = {
  default: 'text-text-primary',
  positive: 'text-accent',
  negative: 'text-danger',
  warning: 'text-warning',
}

function AnimatedValue({ rawValue, duration }: { rawValue: number; duration: number }) {
  const animated = useCountUp(rawValue, duration)
  return <>{formatMoney(animated)}</>
}

export default function KpiCard({
  title,
  value,
  rawValue,
  subtitle,
  icon,
  variant = 'default',
  animate = false,
}: KpiCardProps) {
  const numericValue: number | null = rawValue !== undefined
    ? rawValue
    : (() => {
        const parsed = parseFloat(value.replace(/[^\d.-]/g, ''))
        return isNaN(parsed) ? null : parsed
      })()

  const shouldAnimate = animate && numericValue !== null

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 transition-colors hover:border-accent/30">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-text-muted">{title}</p>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <p className={`mt-2 truncate text-2xl font-semibold tabular-nums ${variants[variant]}`} title={value}>
        {shouldAnimate ? (
          <AnimatedValue rawValue={numericValue as number} duration={800} />
        ) : (
          value
        )}
      </p>
      {subtitle && <p className="mt-1 text-xs text-text-muted">{subtitle}</p>}
    </div>
  )
}
