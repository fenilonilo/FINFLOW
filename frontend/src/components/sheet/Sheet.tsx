import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    ;(el?.querySelector<HTMLElement>(FOCUSABLE) ?? el)?.focus()
    return () => prev?.focus()
  }, [open])

  if (!open) return null

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    } else if (e.key === 'Tab') {
      const items = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
        (el) => !(el as HTMLButtonElement).disabled,
      )
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <>
      <div className="sheet-scrim" data-testid="scrim" onClick={onClose} />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-[18px] top-[18px] h-8 w-8 rounded-full border border-white/10 text-[var(--mu)]"
        >
          ✕
        </button>
        {children}
      </aside>
    </>
  )
}
