import { useReleasesStore } from '../stores/releases'
import type { SortField } from '../services/search'
import { ArrowUpDown } from 'lucide-react'

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'year', label: 'Year' },
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'label', label: 'Label' },
  { value: 'catalog', label: 'Catalog' },
  { value: 'scrapeDate', label: 'Scrape Date' },
]

export function SortControls() {
  const sortField = useReleasesStore((s) => s.sortField)
  const sortDir = useReleasesStore((s) => s.sortDir)
  const setSort = useReleasesStore((s) => s.setSort)

  return (
    <div className="flex items-center gap-2">
      <select
        value={sortField}
        onChange={(e) => setSort(e.target.value as SortField)}
        className="px-2 py-1.5 bg-surface-input border border-border-main rounded-lg text-xs text-content-secondary"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <button
        onClick={() => setSort(sortField)}
        className="p-1.5 bg-surface-input border border-border-main rounded-lg text-content-secondary hover:text-content transition-colors"
        title={sortDir === 'desc' ? 'Descending' : 'Ascending'}
      >
        <ArrowUpDown className={`w-3.5 h-3.5 ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )
}
