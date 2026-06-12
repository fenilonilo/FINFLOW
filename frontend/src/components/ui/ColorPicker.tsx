import { useRef } from 'react'
import { Pipette } from 'lucide-react'

const PALETTE = [
  // Vermelhos / Rosas
  '#ef4444', '#dc2626', '#b91c1c',
  '#f43f5e', '#e11d48', '#fb7185',
  '#f472b6', '#ec4899', '#db2777',
  // Laranjas / Amarelos
  '#f97316', '#ea580c', '#fb923c',
  '#fbbf24', '#f59e0b', '#d97706',
  '#eab308', '#ca8a04', '#fde047',
  // Verdes
  '#84cc16', '#65a30d', '#4ade80',
  '#22c55e', '#16a34a', '#34d399',
  '#10b981', '#059669', '#6ee7b7',
  // Azuis / Cianos
  '#06b6d4', '#0891b2', '#22d3ee',
  '#38bdf8', '#0ea5e9', '#0284c7',
  '#60a5fa', '#3b82f6', '#2563eb',
  // Índigos / Violetas / Roxos
  '#818cf8', '#6366f1', '#4f46e5',
  '#a78bfa', '#8b5cf6', '#7c3aed',
  '#c084fc', '#a855f7', '#9333ea',
  // Neutros
  '#94a3b8', '#64748b', '#475569',
  '#9ca3af', '#6b7280', '#374151',
  '#ffffff', '#e2e8f0', '#cbd5e1',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-3">
      {/* paleta */}
      <div className="grid grid-cols-9 gap-1.5">
        {PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`h-7 w-7 rounded-lg transition-all duration-150 hover:scale-110 hover:shadow-md ${
              value.toLowerCase() === color.toLowerCase()
                ? 'ring-2 ring-offset-2 ring-offset-surface ring-white scale-110 shadow-lg'
                : ''
            }`}
            style={{ backgroundColor: color }}
            aria-label={color}
          />
        ))}
      </div>

      {/* cor customizada */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border-subtle text-text-muted transition-all hover:border-accent hover:text-accent hover:scale-105"
          title="Cor personalizada"
        >
          <Pipette size={14} />
          <input
            ref={inputRef}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
        </button>

        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border-subtle bg-elevated px-3 py-1.5">
          <div
            className="h-4 w-4 flex-shrink-0 rounded-md border border-white/10"
            style={{ backgroundColor: value }}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const v = e.target.value
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
            }}
            onBlur={(e) => {
              if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange('#34d399')
            }}
            maxLength={7}
            className="flex-1 bg-transparent font-mono text-xs text-text-primary outline-none placeholder:text-text-muted"
            placeholder="#000000"
          />
        </div>
      </div>
    </div>
  )
}
