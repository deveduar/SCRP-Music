import type { ReactNode } from 'react'

interface StatsCardProps {
  label: string
  value: string | number
  icon?: ReactNode
}

export function StatsCard({ label, value, icon }: StatsCardProps) {
  return (
    <div className="bg-surface-card border border-border-main rounded-lg p-4">
      <div className="flex items-center gap-2 text-content-muted text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold text-content">{value}</p>
    </div>
  )
}
