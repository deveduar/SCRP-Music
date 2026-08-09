import type { ReactNode } from 'react'

export interface SelectOption {
  value: string
  label: string
}

const inputClass =
  'w-full px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content placeholder:text-content-muted/50 focus:outline-none focus:border-accent/60'

export function FormField({
  label,
  help,
  required,
  children,
  className = '',
}: {
  label: string
  help?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-content mb-1">
        {label}
        {required && <span className="text-accent ml-0.5">*</span>}
      </label>
      {children}
      {help && <p className="text-xs text-content-muted mt-1">{help}</p>}
    </div>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className = '',
  type = 'text',
  id,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  type?: string
  id?: string
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${inputClass} ${className}`}
    />
  )
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${inputClass} ${className}`}
    />
  )
}

export function Select({
  value,
  onChange,
  options,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} cursor-pointer ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  help?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-content">{label}</p>
        {help && <p className="text-xs text-content-muted mt-0.5">{help}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5.5 min-w-10 rounded-full transition-colors cursor-pointer ${
          checked ? 'bg-accent' : 'bg-surface-tertiary'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <h4 className="text-sm font-semibold text-content">{children}</h4>
      {hint && <p className="text-xs text-content-muted mt-0.5">{hint}</p>}
    </div>
  )
}

export function SmallButton({
  children,
  onClick,
  tone = 'default',
  title,
}: {
  children: ReactNode
  onClick: () => void
  tone?: 'default' | 'green' | 'red' | 'accent'
  title?: string
}) {
  const tones: Record<string, string> = {
    default: 'text-content-secondary hover:text-content',
    green: 'text-green-400 hover:text-green-300',
    red: 'text-red-400 hover:text-red-300',
    accent: 'text-accent hover:text-accent-hover',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`text-xs cursor-pointer transition-colors ${tones[tone]}`}
    >
      {children}
    </button>
  )
}
