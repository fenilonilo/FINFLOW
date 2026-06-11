const PALETTE = [
  '#ef4444', '#f97316', '#fb923c', '#fbbf24', '#84cc16',
  '#34d399', '#06b6d4', '#60a5fa', '#818cf8', '#a78bfa',
  '#f472b6', '#fb7185', '#94a3b8', '#64748b', '#ffffff',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
            value === color ? 'ring-2 ring-offset-2 ring-offset-surface ring-white' : ''
          }`}
          style={{ backgroundColor: color }}
          aria-label={color}
        />
      ))}
    </div>
  )
}
