import { useState } from 'react'

// Subset of lucide icons commonly used in finance apps
const ICONS = [
  'heart-pulse', 'utensils', 'gamepad-2', 'car', 'home', 'zap', 'credit-card',
  'shopping-bag', 'trending-up', 'trending-down', 'dollar-sign', 'bar-chart-3',
  'piggy-bank', 'wallet', 'coffee', 'phone', 'wifi', 'music', 'book', 'dumbbell',
  'shirt', 'bus', 'plane', 'gift', 'briefcase', 'wrench', 'stethoscope',
]

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
}

export default function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-subtle bg-elevated text-sm text-text-muted hover:border-accent/50 transition-colors"
      >
        {value || '?'}
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-20 grid grid-cols-7 gap-1 rounded-xl border border-border-subtle bg-surface p-2 shadow-xl">
          {ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              title={icon}
              onClick={() => {
                onChange(icon)
                setOpen(false)
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs transition-colors ${
                value === icon
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:bg-elevated hover:text-text-primary'
              }`}
            >
              {icon.slice(0, 2)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
