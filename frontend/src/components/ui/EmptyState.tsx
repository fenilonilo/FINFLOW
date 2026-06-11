import { type ReactNode } from 'react'

export default function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-text-muted">{icon}</div>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description && <p className="mt-1 text-xs text-text-muted">{description}</p>}
    </div>
  )
}
