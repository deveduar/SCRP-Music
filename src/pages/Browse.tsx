import { useCallback, useRef, useState } from 'react'
import { useReleasesStore } from '../stores/releases'
import type { Release } from '../types/release'
import { ReleaseList } from '../components/ReleaseList'
import { BrowseToolbar } from '../components/BrowseToolbar'
import { Upload } from 'lucide-react'

export function Browse() {
  const inputRef = useRef<HTMLInputElement>(null)
  const loaded = useReleasesStore((s) => s.loaded)
  const loading = useReleasesStore((s) => s.loading)
  const filtered = useReleasesStore((s) => s.filtered)
  const loadReleases = useReleasesStore((s) => s.loadReleases)
  const selectionMode = useReleasesStore((s) => s.selectionMode)
  const selectedIds = useReleasesStore((s) => s.selectedIds)
  const toggleSelection = useReleasesStore((s) => s.toggleSelection)
  const [highlightCount, setHighlightCount] = useState<number | undefined>(undefined)
  const [compactView, setCompactView] = useState(false)

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data: Release[] = JSON.parse(text)
      await loadReleases(data)
    } catch (err) {
      console.error('Failed to load JSON:', err)
    }
  }, [loadReleases])

  if (!loaded && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-content-muted">
          No releases loaded. Use the <strong>Scraper</strong> tab or load a JSON file.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          onChange={handleFile}
          className="hidden"
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-surface-tertiary text-content-secondary rounded-lg hover:bg-border-light hover:text-content transition-colors"
        >
          <Upload className="w-4 h-4" />
          Load JSON File
        </button>
      </div>
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
        onLoadJson={() => inputRef.current?.click()}
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
