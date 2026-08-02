import { Search, X } from 'lucide-react'
import { useReleasesStore } from '../stores/releases'

export function SearchBar() {
  const searchQuery = useReleasesStore((s) => s.searchQuery)
  const setSearchQuery = useReleasesStore((s) => s.setSearchQuery)

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search artists, labels, catalog... "
        className="w-full pl-10 pr-10 py-1.5 bg-surface-input border border-border-main rounded-lg text-sm text-content placeholder-content-muted focus:outline-none focus:border-accent transition-colors"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
