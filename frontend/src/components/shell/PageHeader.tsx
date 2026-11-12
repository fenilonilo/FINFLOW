import type { ReactNode } from 'react'

export default function PageHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  return (
    <div className="rise mb-[clamp(14px,2.4vh,26px)] flex items-end justify-between gap-4">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="h1">{title}</h1>
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </div>
  )
}
