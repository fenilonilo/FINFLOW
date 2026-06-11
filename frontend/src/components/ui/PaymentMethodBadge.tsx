interface PaymentMethodBadgeProps {
  name: string
  color: string
}

export default function PaymentMethodBadge({ name, color }: PaymentMethodBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {name}
    </span>
  )
}
