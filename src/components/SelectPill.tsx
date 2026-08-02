interface SelectPillProps {
  value: string | null
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  className?: string
}

export function SelectPill({ value, onChange, options, placeholder, className = '' }: SelectPillProps) {
  const active = Boolean(value)
  return (
    <div
      className={`relative flex items-center px-2 py-0.5 text-xs rounded-full transition-colors border shadow-sm ${className} ${
        active
          ? 'bg-accent/10 border-accent/30 text-accent'
          : 'bg-surface-input border-border-main text-content-secondary hover:border-border-light'
      }`}
    >
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent outline-none pl-2 pr-5 py-0.5 cursor-pointer max-w-[140px] truncate"
        style={{ colorScheme: 'dark' }}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-2.5 pointer-events-none opacity-50 text-[10px]">▼</div>
    </div>
  )
}
