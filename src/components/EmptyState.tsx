import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  children?: ReactNode
}

export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
      {icon && <div className="text-content-muted">{icon}</div>}
      <p className="text-content font-medium">{title}</p>
      {description && <p className="text-content-muted text-sm max-w-md">{description}</p>}
      {children && <div className="flex flex-wrap gap-2 justify-center">{children}</div>}
    </div>
  )
}
