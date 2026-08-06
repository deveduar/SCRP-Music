import { useRef, useEffect, useState } from 'react'
import { useScraperStore } from '../stores/scraper'
import { useReleasesStore } from '../stores/releases'
import { useSettingsStore } from '../stores/settings'
import type { Genre } from '../types/scraper'
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  List,
} from 'lucide-react'

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function Scraper() {
  const logRef = useRef<HTMLDivElement>(null)

  const adapter = useScraperStore((s) => s.adapter)
  const running = useScraperStore((s) => s.running)
  const paused = useScraperStore((s) => s.paused)
  const progress = useScraperStore((s) => s.progress)
  const results = useScraperStore((s) => s.results)
  const log = useScraperStore((s) => s.log)
  const jobs = useScraperStore((s) => s.jobs)
  const currentJobId = useScraperStore((s) => s.currentJobId)

  const storeDetectPages = useScraperStore((s) => s.detectPages)
  const adapters = useScraperStore((s) => s.adapters)
  const activeAdapterId = useScraperStore((s) => s.activeAdapterId)
  const setActiveAdapter = useScraperStore((s) => s.setActiveAdapter)
  const start = useScraperStore((s) => s.start)
  const pause = useScraperStore((s) => s.pause)
  const resume = useScraperStore((s) => s.resume)
  const cancel = useScraperStore((s) => s.cancel)
  const clearLog = useScraperStore((s) => s.clear)
  const loadJobs = useScraperStore((s) => s.loadJobs)

  const loadReleases = useReleasesStore((s) => s.loadReleases)
  const proxyUrl = useSettingsStore((s) => s.settings.proxyUrl)

  const genres: Genre[] = adapter?.getGenres() ?? []
  const adapterIds = Object.keys(adapters)
  const isApiAdapter = adapter?.kind === 'api'
  const supportsFastSkipExisting = adapter?.supportsFastSkipExisting === true

  const [genreId, setGenreId] = useState('')
  const [startPage, setStartPage] = useState(1)
  const [endPage, setEndPage] = useState(5)
  const [delayPage, setDelayPage] = useState(2000)
  const [delayRelease, setDelayRelease] = useState(1500)
  const [autoLoad, setAutoLoad] = useState(true)
  const [skipExisting, setSkipExisting] = useState(false)
  const [fastSkipExisting, setFastSkipExisting] = useState(false)
  const [genreDetected, setGenreDetected] = useState<{ maxPage: number; detectedAt: string } | null>(null)
  const [detectingGenre, setDetectingGenre] = useState<string | null>(null)
  const [detectError, setDetectError] = useState<string | null>(null)

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  useEffect(() => {
    if (!genreId || !adapter) { setGenreDetected(null); return }
    const cached = adapter.getCachedMaxPage(genreId)
    setGenreDetected(cached)
    if (cached) setEndPage(cached.maxPage)
  }, [genreId, adapter])

  const selectedGenre = genres.find((g) => g.id === genreId) ?? null

  const handleDetect = async () => {
    if (!adapter || !genreId) return
    setDetectingGenre(genreId)
    setDetectError(null)
    const max = await storeDetectPages(genreId, proxyUrl)
    if (max !== null) {
      const cached = adapter.getCachedMaxPage(genreId)
      setGenreDetected(cached)
      if (cached) setEndPage(cached.maxPage)
    } else {
      setDetectError('Detection failed')
    }
    setDetectingGenre(null)
  }

  const handleStartApi = async () => {
    if (!adapter || !selectedGenre || !genreId) return
    start(selectedGenre, {
      genreId,
      startPage,
      endPage,
      delayPage: 0,
      delayRelease: 0,
      proxyUrl,
      fastSkipExisting: false,
    }, autoLoad, skipExisting)
  }

  const handleLoadResults = () => {
    if (results.length > 0) {
      loadReleases(results, currentJobId ?? undefined, skipExisting)
    }
  }

  const handleExport = () => {
    if (results.length === 0) return
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `scrape_export_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const pct = progress
    ? Math.round(((progress.releasesScraped + progress.releasesSkipped) / Math.max(1, progress.releasesFound)) * 100)
    : 0

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border-main flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-content">Scraper</h2>
          <p className="text-xs text-content-muted mt-0.5">
            Scrape releases from your configured adapter
          </p>
        </div>
        </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!adapter && (
          <div className="bg-surface-card border border-border-main rounded-lg p-6 text-center">
            <AlertCircle className="w-8 h-8 text-content-muted mx-auto mb-2" />
            <p className="text-content-muted text-sm">No scraper adapter loaded.</p>
            <p className="text-content-muted text-xs mt-1">
              Provide your own adapter (see documentation) or place an adapter file in <code className="text-content-secondary">local_adapters/</code>.
            </p>
          </div>
        )}

        {adapter && (
        <>
        {adapterIds.length > 1 && (
          <div className="mb-3">
            <label className="text-xs text-content-muted mb-1 block">Source</label>
            <select
              value={activeAdapterId ?? ''}
              onChange={(e) => setActiveAdapter(e.target.value)}
              className="w-full px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content"
            >
              {adapterIds.map((id) => (
                <option key={id} value={id}>{adapters[id].name}</option>
              ))}
            </select>
          </div>
        )}
        {isApiAdapter ? (
          <div>
            <label className="text-xs text-content-muted mb-1 block">Genre</label>
            <div className="flex gap-2">
              <select
                value={genreId}
                onChange={(e) => setGenreId(e.target.value)}
                disabled={running}
                className="flex-1 px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content disabled:opacity-50"
              >
                <option value="">Select genre...</option>
                {genres.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <label className="text-xs text-content-muted mb-1 block">Start page</label>
                <input
                  type="number"
                  min={1}
                  value={startPage}
                  onChange={(e) => setStartPage(Number(e.target.value))}
                  disabled={running}
                  className="w-full px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs text-content-muted mb-1 block">End page</label>
                <input
                  type="number"
                  min={1}
                  value={endPage}
                  onChange={(e) => setEndPage(Number(e.target.value))}
                  disabled={running}
                  className="w-full px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content disabled:opacity-50"
                />
              </div>
            </div>
            <p className="text-xs text-content-muted mt-1 italic">
              Delays and proxy are not needed for API-based sources
            </p>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-content-muted mb-1 block">Genre</label>
            <div className="flex gap-2">
              <select
                value={genreId}
                onChange={(e) => setGenreId(e.target.value)}
                disabled={running}
                className="flex-1 px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content disabled:opacity-50"
              >
                <option value="">Select genre...</option>
                {genres.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
              {genreId && (
                <button
                  onClick={handleDetect}
                  disabled={running || detectingGenre === genreId}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs bg-surface-tertiary text-content-secondary rounded-lg hover:bg-border-light hover:text-content transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {detectingGenre === genreId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  {detectingGenre === genreId ? 'Detecting...' : 'Detect max pages'}
                </button>
              )}
            </div>
            {genreDetected && (
              <p className="text-xs text-content-muted mt-1">
                Max pages: <span className="text-content-secondary font-medium">{genreDetected.maxPage}</span>
                {' '}<span className="italic">(detected {formatRelativeTime(genreDetected.detectedAt)})</span>
              </p>
            )}
            {detectError && (
              <p className="text-xs text-red-400 mt-1">{detectError}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-content-muted mb-1 block">Start page</label>
              <input
                type="number"
                min={1}
                value={startPage}
                onChange={(e) => setStartPage(Number(e.target.value))}
                disabled={running}
                className="w-full px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-content-muted mb-1 block">End page</label>
              <input
                type="number"
                min={1}
                value={endPage}
                onChange={(e) => setEndPage(Number(e.target.value))}
                disabled={running}
                className="w-full px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-content-muted mb-1 block">Delay between pages (ms)</label>
            <input
              type="number"
              min={500}
              step={500}
              value={delayPage}
              onChange={(e) => setDelayPage(Number(e.target.value))}
              disabled={running}
              className="w-full px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-content-muted mb-1 block">Delay between releases (ms)</label>
            <input
              type="number"
              min={500}
              step={500}
              value={delayRelease}
              onChange={(e) => setDelayRelease(Number(e.target.value))}
              disabled={running}
              className="w-full px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content disabled:opacity-50"
            />
          </div>
        </div>
        </>
        )}

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoLoad}
              onChange={(e) => setAutoLoad(e.target.checked)}
              disabled={running}
              className="rounded bg-surface-input border-border-main"
            />
            <span className="text-sm text-content-secondary">Auto-load results into release browser</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              disabled={running}
              className="rounded bg-surface-input border-border-main"
            />
            <span className="text-sm text-content-secondary">Skip updates for existing releases</span>
          </label>
          {supportsFastSkipExisting && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fastSkipExisting}
                onChange={(e) => setFastSkipExisting(e.target.checked)}
                disabled={running}
                className="rounded bg-surface-input border-border-main"
              />
              <span className="text-sm text-content-secondary">Fast skip existing release pages</span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!running ? (
            isApiAdapter ? (
              <button
                onClick={handleStartApi}
                disabled={!genreId}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <Play className="w-4 h-4" />
                Fetch
              </button>
            ) : (
              <button
                onClick={() => {
                  if (selectedGenre) {
                    start(selectedGenre, {
                      genreId,
                      startPage,
                      endPage,
                      delayPage,
                      delayRelease,
                      proxyUrl,
                      fastSkipExisting: supportsFastSkipExisting && fastSkipExisting,
                    }, autoLoad, skipExisting)
                  }
                }}
                disabled={!genreId}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <Play className="w-4 h-4" />
                Start Scraping
              </button>
            )
          ) : (
            <>
              {paused ? (
                <button
                  onClick={resume}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors text-sm"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
              ) : (
                <button
                  onClick={pause}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors text-sm"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
              )}
              <button
                onClick={cancel}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors text-sm"
              >
                <Square className="w-4 h-4" />
                Cancel
              </button>
            </>
          )}
          {results.length > 0 && !running && (
            <>
              <button
                onClick={handleLoadResults}
                className="flex items-center gap-2 px-4 py-2 bg-surface-tertiary text-content-secondary rounded-lg hover:bg-border-light hover:text-content transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Load into Browser ({results.length})
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-surface-tertiary text-content-secondary rounded-lg hover:bg-border-light hover:text-content transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>
            </>
          )}
          {log.length > 0 && !running && (
            <button
              onClick={clearLog}
              className="flex items-center gap-2 px-4 py-2 text-content-muted hover:text-content-secondary transition-colors text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {progress && running && (
          <div className="bg-surface-card border border-border-main rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">
                Page {progress.currentPage} / {progress.pagesTotal}
                {progress.pagesDone > 0 && ` (${progress.pagesDone} done)`}
              </span>
              <span className="text-content-secondary">
                {progress.releasesScraped + progress.releasesSkipped} / {progress.releasesFound} releases
              </span>
            </div>
            <div className="w-full h-2 bg-surface-tertiary rounded overflow-hidden">
              <div
                className="h-full bg-accent rounded transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            {progress.currentRelease && (
              <p className="text-xs text-content-muted truncate">
                <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                {progress.currentRelease}
              </p>
            )}
            {progress.releasesSkipped > 0 && (
              <p className="text-xs text-content-muted">
                {progress.releasesSkipped} existing releases skipped
              </p>
            )}
            {progress.errors > 0 && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {progress.errors} errors
              </p>
            )}
          </div>
        )}
        </>
        )}

        {results.length > 0 && !running && (
          <div className="flex items-center gap-2 text-sm text-content-secondary">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            {results.length} releases scraped
          </div>
        )}

        {log.length > 0 && (
          <div
            ref={logRef}
            className="h-48 bg-surface border border-border-main rounded-lg p-3 overflow-auto font-mono text-xs space-y-0.5"
          >
            {log.map((entry, i) => (
              <p key={i} className={`${entry.startsWith('ERROR') ? 'text-red-400' : 'text-content-muted'}`}>
                {entry}
              </p>
            ))}
          </div>
        )}

        {jobs.length > 0 && (
          <div className="bg-surface-card border border-border-main rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <List className="w-4 h-4 text-content-muted" />
              <h3 className="text-sm font-semibold text-content-secondary">Recent Scrape Jobs</h3>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-auto">
              {jobs.slice(0, 20).map((job) => (
                <div key={job.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs px-2 py-1.5 bg-surface-secondary rounded">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    job.status === 'completed' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <span className="font-medium text-content-secondary truncate max-w-[120px]">{job.genre.label}</span>
                  <span className="text-[10px] text-cyan-500/70">{job.adapterName}</span>
                  <span className="text-content-muted">pages {job.startPage}-{job.endPage}</span>
                  <span className="text-content-muted">—</span>
                  <span className="text-content-secondary">{job.totalReleases} releases</span>
                  {(job.newReleases > 0 || job.updatedReleases > 0) && (
                    <>
                      <span className="text-content-muted">(</span>
                      {job.newReleases > 0 && (
                        <span className="text-green-400">+{job.newReleases} new</span>
                      )}
                      {job.newReleases > 0 && job.updatedReleases > 0 && (
                        <span className="text-content-muted">, </span>
                      )}
                      {job.updatedReleases > 0 && (
                        <span className="text-cyan-400">{job.updatedReleases} updated</span>
                      )}
                      <span className="text-content-muted">)</span>
                    </>
                  )}
                  <span className="text-content-muted ml-auto">{formatRelativeTime(job.date)}</span>
                  {job.status === 'cancelled' && (
                    <span className="text-red-400 text-[10px] uppercase font-semibold">Cancelled</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
