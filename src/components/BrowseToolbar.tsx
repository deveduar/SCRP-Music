import { useState, useMemo } from 'react'
import { useReleasesStore } from '../stores/releases'
import { useScraperStore } from '../stores/scraper'
import { SearchBar } from './SearchBar'
import { SortControls } from './SortControls'
import { BatchActionBar } from './BatchActionBar'
import { ListChecks, Circle, CheckCircle, Heart, LayoutGrid, LayoutList, Upload } from 'lucide-react'
import { SelectPill } from './SelectPill'

function Pill({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded-full transition-colors border shadow-sm ${
        active 
          ? 'bg-accent/10 border-accent/30 text-accent' 
          : 'bg-surface-input border-border-main text-content-secondary hover:text-content hover:border-border-light'
      }`}
    >
      {children}
    </button>
  )
}

export function BrowseToolbar({ compactView, onToggleCompactView, onLoadJson, onHighlightChange }: { compactView: boolean; onToggleCompactView: () => void; onLoadJson: () => void; onHighlightChange: (count: number) => void }) {
  const filterState = useReleasesStore(s => s.filterState)
  const setFilter = useReleasesStore(s => s.setFilter)
  const selectedIds = useReleasesStore(s => s.selectedIds)
  const releases = useReleasesStore(s => s.releases)
  const filtered = useReleasesStore(s => s.filtered)
  const jobs = useScraperStore(s => s.jobs)
  const selectionMode = useReleasesStore(s => s.selectionMode)
  const setSelectionMode = useReleasesStore(s => s.setSelectionMode)
  const clearSelection = useReleasesStore(s => s.clearSelection)
  const selectReleases = useReleasesStore(s => s.selectReleases)
  const searchQuery = useReleasesStore(s => s.searchQuery)

  const [manualBatchMode, setManualBatchMode] = useState(false)

  const isBatchActive = selectedIds.size > 0 || manualBatchMode

  const sources = useMemo(() => Array.from(new Set(releases.map((r) => r.source))).filter(Boolean).sort(), [releases])

  const jobOptions = useMemo(() => {
    const validJobIds = new Set(
      releases
        .filter((r) => !filterState.source || r.source === filterState.source)
        .flatMap((r) => r.scrapeJobIds),
    )

    return jobs
      .filter((j) => validJobIds.has(j.id))
      .map((j) => ({ value: j.id, label: `${j.genre.label} [${j.adapterName}]` }))
  }, [jobs, releases, filterState.source])

  const sourceOptions = sources.map((s) => ({ value: s, label: s }))

  if (isBatchActive) {
    const activeJobIds = new Set(filtered.flatMap(r => r.scrapeJobIds))
    const availableJobs = jobs.filter(j => activeJobIds.has(j.id))

    return (
      <div className="flex flex-col w-full bg-surface border-b border-border-main shadow-sm animate-in fade-in slide-in-from-top-1">
        <BatchActionBar
          releases={filtered}
          onHighlightChange={onHighlightChange}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onSelectionModeChange={setSelectionMode}
          onClearSelection={clearSelection}
          onClose={() => { clearSelection(); setManualBatchMode(false); onHighlightChange(0) }}
          onSelectReleases={selectReleases}
          jobs={availableJobs}
          searchQuery={searchQuery}
          filterState={filterState}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col border-b border-border-main bg-surface shadow-sm min-h-24">
      {/* Top Row: Search & Essentials */}
      <div className="flex flex-wrap items-center gap-2 p-3 lg:px-4 lg:py-3">
        <button
          onClick={() => setManualBatchMode(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-input border border-border-main text-content-secondary rounded-lg hover:bg-surface-tertiary hover:text-content transition-colors shadow-sm font-medium"
        >
          <ListChecks className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1 min-w-[180px] max-w-xs">
          <SearchBar />
        </div>
        <SortControls />
        <button
          onClick={onToggleCompactView}
          className="shrink-0 p-1.5 bg-surface-input border border-border-main text-content-secondary rounded-lg hover:bg-surface-tertiary hover:text-content transition-colors shadow-sm"
          title={compactView ? 'Full view' : 'Compact view'}
        >
          {compactView ? <LayoutList className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
        </button>
        <button
          onClick={onLoadJson}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-tertiary text-content-secondary rounded-lg hover:bg-border-light hover:text-content transition-colors"
        >
          <Upload className="w-4 h-4" />
        </button>
      </div>

      {/* Middle Row: Pills Filters */}
      <div className="flex flex-wrap items-center gap-2.5 px-3 lg:px-4">
        <span className="text-xs text-content-muted font-medium mr-1 uppercase tracking-wider">Filters:</span>
        <Pill active={filterState.listened} onClick={() => setFilter({ listened: !filterState.listened })}>
          <CheckCircle className={`w-3.5 h-3.5 ${filterState.listened ? 'text-green-400' : ''}`} />
        </Pill>
        <Pill active={filterState.unlistened} onClick={() => setFilter({ unlistened: !filterState.unlistened })}>
          <Circle className={`w-3.5 h-3.5 ${filterState.unlistened ? 'text-amber-400' : ''}`} />
        </Pill>
        <Pill active={filterState.favorite} onClick={() => setFilter({ favorite: !filterState.favorite })}>
          <Heart className={`w-3.5 h-3.5 ${filterState.favorite ? 'text-red-400 fill-current' : ''}`} />
        </Pill>

        <div className="w-px h-4 bg-border-main mx-1" />

        <SelectPill
          value={filterState.scrapeJobId}
          onChange={(v: string) => setFilter({ scrapeJobId: v || null })}
          options={jobOptions}
          placeholder="All scrapes"
        />
        <SelectPill
          value={filterState.source}
          onChange={(v: string) => setFilter({ source: v || null })}
          options={sourceOptions}
          placeholder="All sources"
        />
      </div>

      {/* Bottom Row: Dynamic info */}
      <div className="px-3 pb-3 lg:px-4 text-xs text-content-muted">
        {(() => {
          const parts: string[] = []
          if (searchQuery) parts.push(`"${searchQuery}"`)
          if (filterState.listened) parts.push('listened')
          if (filterState.unlistened) parts.push('unlistened')
          if (filterState.favorite) parts.push('favorite')
          if (filterState.source) parts.push(`source: ${filterState.source}`)
          if (filterState.scrapeJobId) {
            const j = jobs.find(jj => jj.id === filterState.scrapeJobId)
            parts.push(`job: ${j ? `${j.genre.label} p.${j.startPage}` : 'unknown'}`)
          }
          const showBoth = filtered.length !== releases.length
          const countText = showBoth ? `${filtered.length} of ${releases.length}` : `${releases.length}`
          const suffix = parts.length > 0 ? ` matching: ${parts.join(', ')}` : ''
          return <span>{countText} release{releases.length !== 1 ? 's' : ''}{suffix}</span>
        })()}
      </div>
    </div>
  )
}
