import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'

export interface TabItem { id: string; label: string }

export default function Tabs({ tabs, value, onChange }: { tabs: TabItem[]; value: string; onChange: (id: string) => void }) {
  const bar = useRef<HTMLDivElement>(null)
  const ind = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const move = () => {
      const b = bar.current?.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!b || !b.offsetWidth || !ind.current) return
      ind.current.style.left = `${b.offsetLeft}px`
      ind.current.style.width = `${b.offsetWidth}px`
    }
    move()
    void document.fonts?.ready.then(move)
    const ro = typeof ResizeObserver !== 'undefined' && bar.current ? new ResizeObserver(move) : null
    if (ro && bar.current) ro.observe(bar.current)
    window.addEventListener('resize', move)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', move)
    }
  }, [value, tabs])

  function onKey(e: KeyboardEvent) {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const next = tabs[(tabs.findIndex((t) => t.id === value) + d + tabs.length) % tabs.length]
    onChange(next.id)
    requestAnimationFrame(() => document.getElementById(`tab-${next.id}`)?.focus())
  }

  return (
    <div ref={bar} className="tabs rise" role="tablist" onKeyDown={onKey}>
      <div ref={ind} className="ind" />
      {tabs.map((t) => (
        <button
          key={t.id} id={`tab-${t.id}`} type="button" role="tab" aria-selected={t.id === value} aria-controls={`panel-${t.id}`}
          tabIndex={t.id === value ? 0 : -1} className={t.id === value ? 'on' : ''} onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
