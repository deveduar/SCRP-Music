import { useEffect, useMemo } from 'react'
import { useReleasesStore } from '../stores/releases'
import { useUserStateStore } from '../stores/user-state'
import { useScraperStore } from '../stores/scraper'
import { StatsCard } from '../components/StatsCard'
import { DiscAlbum, Heart, Headphones, Clock, Users, Building2, Link2, MousePointerClick, History, CheckCircle2, XCircle } from 'lucide-react'

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function Dashboard() {
  const releases = useReleasesStore((s) => s.releases)
  const loaded = useReleasesStore((s) => s.loaded)
  const states = useUserStateStore((s) => s.states)
  const history = useUserStateStore((s) => s.history)
  const historyLoaded = useUserStateStore((s) => s.loaded)
  const loadHistory = useUserStateStore((s) => s.loadHistory)
  const jobs = useScraperStore((s) => s.jobs)

  useEffect(() => {
    if (!historyLoaded) loadHistory()
  }, [historyLoaded, loadHistory])

  const stats = useMemo(() => {
    if (!loaded) return null
    const artists = new Set(releases.flatMap((r) => r.artists))
    const labels = new Set(releases.map((r) => r.label).filter(Boolean))
    const years = releases.map((r) => r.year).filter(Boolean)
    const stateValues = Object.values(states)
    const totalDownloads = releases.reduce((s, r) => s + r.downloads.length, 0)

    const downloadsByHost = new Map<string, number>()
    for (const r of releases) {
      for (const d of r.downloads) {
        downloadsByHost.set(d.host, (downloadsByHost.get(d.host) ?? 0) + 1)
      }
    }
    const sortedHosts = Array.from(downloadsByHost.entries())
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count)
    const maxHostCount = sortedHosts[0]?.count ?? 1

    const clickEntries = history.filter(
      (h) => h.action === 'link_clicked' && h.detail?.startsWith('download:'),
    )
    const clicksByHost = new Map<string, number>()
    for (const h of clickEntries) {
      const host = h.detail!.replace('download:', '')
      clicksByHost.set(host, (clicksByHost.get(host) ?? 0) + 1)
    }
    const sortedClicks = Array.from(clicksByHost.entries())
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count)
    const maxClickCount = sortedClicks[0]?.count ?? 1

    const lastJob = jobs[0] ?? null

    return {
      total: releases.length,
      totalRaw: jobs.reduce((s, j) => s + Math.max(0, j.totalReleases), 0),
      listened: stateValues.filter((s) => s.listenStatus === 'listened').length,
      favorites: stateValues.filter((s) => s.favorite).length,
      artists: artists.size,
      labels: labels.size,
      oldest: Math.min(...years),
      newest: Math.max(...years),
      totalDownloads,
      sortedHosts,
      maxHostCount,
      sortedClicks,
      maxClickCount,
      lastJob,
    }
  }, [loaded, releases, states, history, jobs])

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-content-muted">No releases loaded. Go to Scraper or Browse to load data.</p>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="p-6 overflow-auto h-full space-y-6">
      <h2 className="text-xl font-bold text-content">Dashboard</h2>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatsCard label="Unique Releases" value={stats.total} icon={<DiscAlbum className="w-4 h-4" />} />
        <StatsCard label="Raw Scraped" value={stats.totalRaw} icon={<DiscAlbum className="w-4 h-4 opacity-50" />} />
        <StatsCard label="Listened" value={stats.listened} icon={<Headphones className="w-4 h-4" />} />
        <StatsCard label="Favorites" value={stats.favorites} icon={<Heart className="w-4 h-4" />} />
        <StatsCard label="Artists" value={stats.artists} icon={<Users className="w-4 h-4" />} />
        <StatsCard label="Labels" value={stats.labels} icon={<Building2 className="w-4 h-4" />} />
        <StatsCard label="Year Range" value={`${stats.oldest} - ${stats.newest}`} icon={<Clock className="w-4 h-4" />} />
        <StatsCard label="Download Links" value={stats.totalDownloads.toLocaleString()} icon={<Link2 className="w-4 h-4" />} />
      </div>

      {/* Last Scrape Job */}
      {stats.lastJob && (
        <div className="bg-surface-card border border-border-main rounded-lg p-4">
          <div className="flex items-center gap-2 text-content-muted text-xs mb-2">
            <History className="w-4 h-4" />
            <span>Last Scrape</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-content-secondary font-medium">{stats.lastJob.genre.label}</span>
            <span className="text-[10px] text-cyan-500/70">{stats.lastJob.adapterName}</span>
            <span className="text-content-muted">pages {stats.lastJob.startPage}-{stats.lastJob.endPage}</span>
            <span className="text-content-muted">·</span>
            <span className="text-content-secondary">{stats.lastJob.totalReleases} releases</span>
            {stats.lastJob.newReleases > 0 && (
              <span className="text-green-400">+{stats.lastJob.newReleases} new</span>
            )}
            {stats.lastJob.updatedReleases > 0 && (
              <span className="text-cyan-400">{stats.lastJob.updatedReleases} updated</span>
            )}
            <span className="text-content-muted ml-auto">{formatRelativeTime(stats.lastJob.date)}</span>
            {stats.lastJob.status === 'completed' ? (
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Downloads by host */}
        <div className="bg-surface-card border border-border-main rounded-lg p-4">
          <div className="flex items-center gap-2 text-content-muted text-xs mb-3">
            <Link2 className="w-4 h-4" />
            <span>Downloads by Host</span>
          </div>
          <div className="space-y-1.5">
            {stats.sortedHosts.slice(0, 15).map(({ host, count }) => (
              <div key={host} className="flex items-center gap-2 text-sm">
                <span className="text-content-secondary w-28 truncate shrink-0">{host}</span>
                <div className="flex-1 h-4 bg-surface-tertiary rounded overflow-hidden">
                  <div
                    className="h-full bg-accent/60 rounded"
                    style={{ width: `${(count / stats.maxHostCount) * 100}%` }}
                  />
                </div>
                <span className="text-content-muted text-xs w-12 text-right">{count}</span>
              </div>
            ))}
            {stats.sortedHosts.length === 0 && (
              <p className="text-xs text-content-muted">No download links found.</p>
            )}
          </div>
        </div>

        {/* Clicks by host (from history) */}
        <div className="bg-surface-card border border-border-main rounded-lg p-4">
          <div className="flex items-center gap-2 text-content-muted text-xs mb-3">
            <MousePointerClick className="w-4 h-4" />
            <span>Clicks by Host (history)</span>
          </div>
          <div className="space-y-1.5">
            {stats.sortedClicks.slice(0, 15).map(({ host, count }) => (
              <div key={host} className="flex items-center gap-2 text-sm">
                <span className="text-content-secondary w-28 truncate shrink-0">{host}</span>
                <div className="flex-1 h-4 bg-surface-tertiary rounded overflow-hidden">
                  <div
                    className="h-full bg-cyan-500/60 rounded"
                    style={{ width: `${(count / stats.maxClickCount) * 100}%` }}
                  />
                </div>
                <span className="text-content-muted text-xs w-12 text-right">{count}</span>
              </div>
            ))}
            {stats.sortedClicks.length === 0 && (
              <p className="text-xs text-content-muted">No download clicks recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
