import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { Release } from '../types/release'
import type { ScrapeJob } from '../types/scraper'
import { findAllLinks } from '../services/links'
import { SelectPill } from './SelectPill'
import { collectUrls, openSequentially, getHostsWithCount, executeBatchStateAction, normalizeHostDisplay, type BatchAction } from '../services/batch-actions'
import { useUserStateStore } from '../stores/user-state'
import { Play, Square, ExternalLink, CheckCircle2, Loader2, X } from 'lucide-react'

import type { FilterState } from '../stores/releases'

interface BatchActionBarProps {
  releases: Release[]
  onHighlightChange: (count: number) => void
  selectionMode: boolean
  selectedIds: Set<string>
  onSelectionModeChange: (v: boolean) => void
  onClearSelection: () => void
  onClose: () => void
  onSelectReleases: (criteria: string) => void
  jobs: ScrapeJob[]
  searchQuery?: string
  filterState?: FilterState
}

const STORAGE_KEY = 'batch_action_bar'

interface PersistedState {
  expanded: boolean
  count: number
  mode: string
  target: string
  delay: number
  autoMark: string[]
  selectJobId: string
}

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaultState, ...JSON.parse(raw) }
  } catch {}
  return { ...defaultState }
}

function savePersisted(s: PersistedState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

const defaultState: PersistedState = {
  expanded: true,
  count: 50,
  mode: 'download',
  target: '',
  delay: 1500,
  autoMark: [],
  selectJobId: '',
}

const MODE_OPTIONS: { value: string; label: string }[] = [
  { value: 'download', label: 'Download from…' },
  { value: 'search', label: 'Search in…' },
  { value: 'mark-listened', label: 'Mark Listened' },
  { value: 'mark-unlistened', label: 'Mark Unlistened' },
  { value: 'mark-favorite', label: 'Mark Favorite' },
  { value: 'mark-unfavorite', label: 'Mark Unfavorite' },
]

export function BatchActionBar({
  releases, onHighlightChange,
  selectionMode, selectedIds, onSelectionModeChange, onClearSelection, onClose, onSelectReleases, jobs,
  searchQuery, filterState,
}: BatchActionBarProps) {
  const persisted = useRef(loadPersisted())
  const [expanded] = useState(persisted.current.expanded)
  const [count, setCount] = useState(persisted.current.count)
  const [mode, setMode] = useState(persisted.current.mode)
  const [target, setTarget] = useState(persisted.current.target)
  const [delay, setDelay] = useState(persisted.current.delay)
  const [autoMark, setAutoMark] = useState<string[]>(persisted.current.autoMark ?? [])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [doneLabel, setDoneLabel] = useState<string | null>(null)
  const [selectJobId, setSelectJobId] = useState(persisted.current.selectJobId)
  const controllerRef = useRef<AbortController | null>(null)
  const { setListenStatus, setFavorite, toggleFavorite, logAction } = useUserStateStore()

  useEffect(() => {
    const hl = selectionMode ? selectedIds.size : count
    onHighlightChange(expanded && hl > 0 ? hl : 0)
  }, [])

  const persist = useCallback((partial: Partial<PersistedState>) => {
    const next = { expanded, count, mode, target, delay, autoMark, selectJobId, ...partial }
    savePersisted(next)
  }, [expanded, count, mode, target, delay, autoMark, selectJobId])

  // Releases that will actually be opened — drives which hosts are shown
  const effectiveReleasesForHosts = useMemo(() => {
    if (selectionMode) return releases.filter((r) => selectedIds.has(r.id))
    return releases.slice(0, count)
  }, [selectionMode, releases, selectedIds, count])

  const hostsWithCount = useMemo(
    () => getHostsWithCount(effectiveReleasesForHosts),
    [effectiveReleasesForHosts],
  )

  const countsByStatus = useMemo(() => {
    const states = useUserStateStore.getState().states
    return {
      listened:    releases.filter((r) => states[r.id]?.listenStatus === 'listened').length,
      unlistened:  releases.filter((r) => (states[r.id]?.listenStatus ?? 'unlistened') !== 'listened').length,
      favorite:    releases.filter((r) => states[r.id]?.favorite === true).length,
      unfavorite:  releases.filter((r) => !states[r.id]?.favorite).length,
    }
  }, [releases])

  // Bugfix: restore selectJobId from localStorage only if it makes sense
  useEffect(() => {
    if (selectJobId && selectedIds.size === 0) {
      setSelectJobId('')
      persist({ selectJobId: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isUrlMode = mode === 'download' || mode === 'search'
  const isMarkMode = mode.startsWith('mark-')

  // Auto-reset target when the available host list changes and the current
  // target is no longer present (e.g. after a source filter change)
  useEffect(() => {
    if (mode !== 'download') return
    if (!target) return
    if (!hostsWithCount.some((h) => h.host === target)) {
      setTarget('')
    }
  }, [hostsWithCount, mode, target])

  const hasValidCount = selectionMode ? selectedIds.size > 0 : count > 0

  const projectedOpenCount = useMemo(() => {
    if (!hasValidCount || effectiveReleasesForHosts.length === 0) return 0
    if (isUrlMode && mode === 'download') {
      if (!target) return 0
      const norm = normalizeHostDisplay(target)
      return effectiveReleasesForHosts.filter((r) =>
        r.downloads.some((d) => normalizeHostDisplay(d.host) === norm),
      ).length
    }
    return effectiveReleasesForHosts.length
  }, [hasValidCount, effectiveReleasesForHosts, isUrlMode, mode, target])

  const canExecute = running === false && releases.length > 0 && hasValidCount && (
    (mode === 'download' && target && hostsWithCount.some((h) => h.host === target))
    || (mode === 'search' && target)
    || isMarkMode
  )

  const handleCountChange = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(val, releases.length))
    setCount(clamped)
    onHighlightChange(clamped)
    persist({ count: clamped })
  }, [onHighlightChange, persist, releases.length])

  const getTargetReleases = useCallback((): Release[] => {
    if (selectionMode) return releases.filter((r) => selectedIds.has(r.id))
    return releases.slice(0, count)
  }, [selectionMode, releases, selectedIds, count])

  const handleExecute = useCallback(async () => {
    if (!canExecute) return

    const targetReleases = getTargetReleases()

    setDoneLabel(null)

    if (isUrlMode) {
      const action: BatchAction = mode === 'download'
        ? { type: 'download', host: target }
        : { type: 'search', linkId: target }

      const entries = collectUrls(targetReleases, targetReleases.length, action)
      if (entries.length === 0) return

      const controller = new AbortController()
      controllerRef.current = controller
      setRunning(true)
      setProgress(0)
      setTotal(entries.length)

      await openSequentially(
        entries,
        delay,
        controller.signal,
        (opened, total) => {
          setProgress(opened)
          setTotal(total)
        },
        autoMark.length > 0 ? (releaseId) => {
          if (autoMark.includes('listened')) {
            setListenStatus(releaseId, 'listened')
            logAction(releaseId, 'listened')
          }
          if (autoMark.includes('unlistened')) {
            setListenStatus(releaseId, 'unlistened')
            logAction(releaseId, 'unlistened')
          }
          if (autoMark.includes('favorite')) {
            setFavorite(releaseId, true)
            logAction(releaseId, 'favorited')
          }
          if (autoMark.includes('unfavorite')) {
            setFavorite(releaseId, false)
            logAction(releaseId, 'unfavorited')
          }
        } : undefined,
      )

      setRunning(false)
      controllerRef.current = null
      setDoneLabel(`Opened ${entries.length} URLs`)

      logAction('', 'batch_action', JSON.stringify({
        count: entries.length,
        mode,
        target,
        autoMark,
        selectionMode,
      }))
    } else if (isMarkMode) {
      const action = { type: mode } as BatchAction
      setRunning(true)
      setProgress(0)
      setTotal(targetReleases.length)

      await executeBatchStateAction(
        targetReleases,
        targetReleases.length,
        action,
        { setListenStatus, toggleFavorite, logAction },
        (done, total) => {
          setProgress(done)
          setTotal(total)
        },
      )

      setRunning(false)
      setDoneLabel(`${mode === 'mark-listened' ? 'Listened' : mode === 'mark-unlistened' ? 'Unlistened' : mode === 'mark-favorite' ? 'Favorited' : 'Unfavorited'} ${targetReleases.length} releases`)

      logAction('', 'batch_action', JSON.stringify({
        count: targetReleases.length,
        mode,
        selectionMode,
      }))
    }
  }, [canExecute, isUrlMode, isMarkMode, mode, target, getTargetReleases, count, selectionMode, delay, autoMark, setListenStatus, setFavorite, toggleFavorite, logAction])

  const handleCancel = useCallback(() => {
    controllerRef.current?.abort()
    setRunning(false)
  }, [])

  const handleModeChange = useCallback((newMode: string) => {
    setMode(newMode)
    setTarget('')        // always clear target when mode changes
    setDoneLabel(null)
    persist({ mode: newMode, target: '' })
  }, [persist])

  const handleSelectionToggle = useCallback((v: boolean) => {
    onSelectionModeChange(v)
    setDoneLabel(null)
    if (!v && count === 0) {
      onHighlightChange(0)
    } else {
      const hl = v ? selectedIds.size : count
      onHighlightChange(expanded ? hl : 0)
    }
  }, [onSelectionModeChange, onHighlightChange, selectedIds, count, expanded])

  const handleClear = useCallback(() => {
    onClearSelection()
    setSelectJobId('')
    persist({ selectJobId: '' })
  }, [onClearSelection, persist])

  const handleResetCount = useCallback(() => {
    setCount(0)
    onHighlightChange(0)
    persist({ count: 0 })
  }, [onHighlightChange, persist])

  const handleClose = useCallback(() => {
    setSelectJobId('')
    persist({ selectJobId: '' })
    onClose()
  }, [onClose, persist])

  const handleSelectReleases = useCallback((criteria: string) => {
    setSelectJobId(criteria)
    persist({ selectJobId: criteria })
    onSelectReleases(criteria)
  }, [onSelectReleases, persist])

  const selectionLabel = useMemo(() => {
    if (!selectionMode) return null
    if (!selectJobId) return null
    if (selectJobId === '__all__') return 'all'
    if (selectJobId === 'listened') return 'listened'
    if (selectJobId === 'unlistened') return 'unlistened'
    if (selectJobId === 'favorite') return 'favorite'
    if (selectJobId === 'unfavorite') return 'unfavorite'
    const job = jobs.find((j) => j.id === selectJobId)
    return job ? `job: ${job.genre.label} p.${job.startPage}` : selectJobId
  }, [selectionMode, selectJobId, jobs])

  const actionSummary = useMemo(() => {
    const actionLabel = MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode
    const parts = [`Action: ${actionLabel}`]
    if (isUrlMode && mode === 'download' && target) {
      const host = hostsWithCount.find((h) => h.host === target)
      parts[0] = `Action: ${actionLabel} ${host ? host.displayName : target}`
    }
    if (isUrlMode && mode === 'search' && target) {
      const link = findAllLinks().find((l) => l.id === target)
      if (link) parts[0] = `Action: ${actionLabel} ${link.label}`
    }
    if (!selectionMode) parts.push(`Count: ${count}`)
    else parts.push(`Selected: ${selectedIds.size}${selectionLabel ? ` (${selectionLabel})` : ''}`)
    if (isUrlMode) parts.push(`Delay: ${delay}ms`)
    if (autoMark.length > 0) parts.push(`Auto-mark: ${autoMark[0]}`)
    return parts.join(' | ')
  }, [mode, isUrlMode, target, hostsWithCount, selectionMode, count, selectedIds.size, delay, autoMark, selectionLabel])

  const filterSummary = useMemo(() => {
    const parts: string[] = []
    if (searchQuery) parts.push(`"${searchQuery}"`)
    if (filterState?.source) parts.push(`source: ${filterState.source}`)
    if (filterState?.listened) parts.push('listened')
    if (filterState?.unlistened) parts.push('unlistened')
    if (filterState?.favorite) parts.push('favorite')
    if (filterState?.scrapeJobId) {
      const job = jobs.find((j) => j.id === filterState.scrapeJobId)
      parts.push(`job: ${job ? `${job.genre.label} p.${job.startPage}` : 'unknown'}`)
    }
    const scope = selectionMode
      ? `${selectedIds.size} selected${selectionLabel ? ` (${selectionLabel})` : ''}`
      : `first ${Math.min(count, releases.length)} of ${releases.length}`
    if (parts.length === 0) return `Showing ${scope}`
    return `Showing ${scope} matching: ${parts.join(', ')}`
  }, [searchQuery, filterState, releases.length, selectionMode, selectedIds.size, count, jobs, selectionLabel])

  return (
    <div className="flex flex-col w-full bg-surface border-b border-border-main shadow-sm min-h-28">
      {/* Row 1: Main controls */}
      <div className="flex flex-wrap items-center gap-2 px-3 lg:px-4 py-3 w-full">
        {/* Left: Close and Count/Selection */}
        <div className="flex items-center gap-3 pr-3 border-r border-border-main shrink-0">
          <button
            onClick={handleClose}
            className="p-1.5 text-content-muted hover:text-content-secondary hover:bg-surface-tertiary rounded-lg transition-colors"
            title="Exit Batch Mode"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex rounded-lg overflow-hidden border border-border-main shadow-sm bg-surface-input">
            <button
              onClick={() => handleSelectionToggle(false)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                !selectionMode ? 'bg-accent text-white' : 'text-content-muted hover:text-content-secondary'
              }`}
            >
              Count
            </button>
            <button
              onClick={() => handleSelectionToggle(true)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                selectionMode ? 'bg-accent text-white' : 'text-content-muted hover:text-content-secondary'
              }`}
            >
              Selection
            </button>
          </div>
        </div>

        {/* Center: Dynamic controls */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-content-muted font-medium shrink-0">Action:</span>
            <select
              value={mode}
              onChange={(e) => handleModeChange(e.target.value)}
              className="px-2 py-1.5 text-xs bg-surface-input border border-border-main rounded-lg text-content-secondary shadow-sm"
              style={{ colorScheme: 'dark' }}
            >
              {MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {isUrlMode && (
            <div className="flex items-center gap-2">
              {mode === 'download' && hostsWithCount.length === 0 ? (
                <span className="text-xs text-content-muted italic">No hosts</span>
              ) : (
                <select
                  value={target}
                  onChange={(e) => { setTarget(e.target.value); persist({ target: e.target.value }) }}
                  className="max-w-[160px] px-2 py-1.5 text-xs bg-surface-input border border-border-main rounded-lg text-content-secondary shadow-sm"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="">— target —</option>
                  {mode === 'download'
                    ? hostsWithCount.map(({ host, displayName, count: c }) => (
                        <option key={host} value={host}>{displayName} ({c})</option>
                      ))
                    : findAllLinks().map((l) => (
                        <option key={l.id} value={l.id}>{l.label}</option>
                      ))
                  }
                </select>
              )}
            </div>
          )}

          {isUrlMode && (
            <div className="flex items-center gap-2" title="Delay in ms">
              <span className="text-xs text-content-muted font-medium shrink-0">Delay:</span>
              <input
                type="number"
                min={200}
                max={10000}
                step={100}
                value={delay}
                onChange={(e) => { setDelay(Number(e.target.value)); persist({ delay: Number(e.target.value) }) }}
                className="w-16 px-2 py-1.5 text-xs bg-surface-input border border-border-main rounded-lg text-content-secondary shadow-sm"
              />
            </div>
          )}

          {isUrlMode && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-content-muted font-medium shrink-0">Auto-mark:</span>
              <select
                value={autoMark[0] || ''}
                onChange={(e) => {
                  const opts = e.target.value ? [e.target.value] : []
                  setAutoMark(opts)
                  persist({ autoMark: opts })
                }}
                className="w-[100px] px-2 py-1.5 text-xs bg-surface-input border border-border-main rounded-lg text-content-secondary shadow-sm"
                style={{ colorScheme: 'dark' }}
              >
                <option value="">None</option>
                <option value="listened">Listened</option>
                <option value="unlistened">Unlistened</option>
                <option value="favorite">Favorite</option>
                <option value="unfavorite">Unfav.</option>
              </select>
            </div>
          )}
        </div>

        {/* Row 1 ends — execute button is in Row 2 */}
      </div>
      
      {/* Row 2: Selection controls */}
      <div className="flex flex-wrap items-center gap-2 px-3 lg:px-4 py-1.5 border-t border-border-main/50 w-full">
        <div className="flex items-center gap-2">
          {!selectionMode ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-content-muted font-medium">Count:</span>
              <input
                type="number"
                min={0}
                max={releases.length}
                value={count}
                onChange={(e) => handleCountChange(Number(e.target.value))}
                className="w-16 px-2 py-1.5 text-xs bg-surface-input border border-border-main rounded-lg text-content-secondary shadow-sm"
              />
              {count > 0 && (
                <button
                  onClick={handleResetCount}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs uppercase font-bold tracking-wider bg-surface-tertiary text-content-muted rounded-lg hover:bg-surface-tertiary hover:text-content-secondary transition-colors"
                  title="Reset count"
                >
                  Reset
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-content-secondary font-medium">{selectedIds.size} selected</span>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleClear}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs uppercase font-bold tracking-wider bg-surface-tertiary text-content-muted rounded-lg hover:bg-surface-tertiary hover:text-content-secondary transition-colors"
                  title="Clear selection"
                >
                  Clear
                </button>
              )}
              <SelectPill
                value={selectJobId}
                onChange={handleSelectReleases}
                options={[
                  ...(countsByStatus.listened > 0 ? [{ value: 'listened', label: `Listened (${countsByStatus.listened})` }] : []),
                  ...(countsByStatus.unlistened > 0 ? [{ value: 'unlistened', label: `Unlistened (${countsByStatus.unlistened})` }] : []),
                  ...(countsByStatus.favorite > 0 ? [{ value: 'favorite', label: `Favorite (${countsByStatus.favorite})` }] : []),
                  ...(countsByStatus.unfavorite > 0 ? [{ value: 'unfavorite', label: `Unfavorite (${countsByStatus.unfavorite})` }] : []),
                  ...(releases.length > 0 ? [{ value: '__all__', label: `All releases (${releases.length})` }] : []),
                  ...jobs.map(j => ({ value: j.id, label: `${j.genre.label} p.${j.startPage}` })),
                ]}
                placeholder="— None —"
                className="max-w-[140px]"
              />
            </div>
          )}
          {running && (
            <div className="flex items-center gap-2 text-xs font-medium text-accent shrink-0">
              {isUrlMode ? <ExternalLink className="w-3.5 h-3.5 animate-pulse" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {progress}/{total}
            </div>
          )}
          {doneLabel && !running && (
            <div className="flex items-center gap-1.5 text-xs text-green-400 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {doneLabel}
            </div>
          )}
          {!running ? (
            <button
              onClick={handleExecute}
              disabled={!canExecute}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              {isUrlMode ? `Open ${projectedOpenCount}` : `Run ${projectedOpenCount}`}
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors shadow-sm shrink-0"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Row 3: Dynamic info */}
      <div className="px-3 lg:px-4 pb-2 text-[11px] text-content-muted">
        <span className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-accent/50 shrink-0" />
          {filterSummary}
        </span>
        {hasValidCount ? (
          <>
            <span className="text-content-muted/30 mx-1">·</span>
            <span>{actionSummary}</span>
          </>
        ) : (
          <span className="text-content-muted/50 italic">Select releases above or use the job selector</span>
        )}
      </div>
    </div>
  )
}
