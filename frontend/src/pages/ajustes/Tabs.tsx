import { useLayoutEffect, useRef } from 'react'

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
    window.addEventListener('resize', move)
    return () => window.removeEventListener('resize', move)
  }, [value, tabs])

  return (
    <div ref={bar} className="tabs rise" role="tablist">
      <div ref={ind} className="ind" />
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === value} className={t.id === value ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
