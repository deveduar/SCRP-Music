import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useReleasesStore } from '../stores/releases'
import { ReleaseList } from '../components/ReleaseList'
import { BrowseToolbar } from '../components/BrowseToolbar'
import { EmptyState } from '../components/EmptyState'
import { useJsonReleasesImport } from '../hooks/useJsonReleasesImport'
import { Upload, Globe } from 'lucide-react'

export function Browse() {
  const { inputRef, handleFile, openPicker } = useJsonReleasesImport()
  const loaded = useReleasesStore((s) => s.loaded)
  const loading = useReleasesStore((s) => s.loading)
  const filtered = useReleasesStore((s) => s.filtered)
  const selectionMode = useReleasesStore((s) => s.selectionMode)
  const selectedIds = useReleasesStore((s) => s.selectedIds)
  const toggleSelection = useReleasesStore((s) => s.toggleSelection)
  const [highlightCount, setHighlightCount] = useState<number | undefined>(undefined)
  const [compactView, setCompactView] = useState(false)

  if (!loaded && !loading) {
    return (
      <EmptyState
        icon={<Globe className="w-12 h-12" />}
        title="No releases to browse"
        description={
          <>
            Scrape releases with an adapter on the Scraper tab, or load a release library from a
            JSON file.
          </>
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          onChange={handleFile}
          className="hidden"
        />
        <Link
          to="/scraper"
          className="flex items-center gap-2 px-4 py-2 bg-accent/15 text-accent border border-accent/30 rounded-lg hover:bg-accent/25 transition-colors text-sm font-medium"
        >
          <Globe className="w-4 h-4" />
          Go to Scraper
        </Link>
        <button
          onClick={openPicker}
          className="flex items-center gap-2 px-4 py-2 bg-surface-tertiary text-content-secondary rounded-lg hover:bg-border-light hover:text-content transition-colors text-sm"
        >
          <Upload className="w-4 h-4" />
          Load JSON
        </button>
      </EmptyState>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-content-muted">Loading and indexing releases...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        onChange={handleFile}
        className="hidden"
      />
      
      <BrowseToolbar
        compactView={compactView}
        onToggleCompactView={() => setCompactView((prev) => !prev)}
        onLoadJson={openPicker}
        onHighlightChange={setHighlightCount}
      />

      <div className="flex-1 overflow-hidden">
        <ReleaseList
          releases={filtered}
          compactView={compactView}
          highlightCount={highlightCount}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
        />
      </div>
    </div>
  )
}
