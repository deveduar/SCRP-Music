import { useEffect } from 'react'
import { useUserStateStore } from '../stores/user-state'
import { useReleasesStore } from '../stores/releases'
import { findQuickLink } from '../services/links'
import { ExternalLink, CheckCircle2, XCircle, Layers, Play } from 'lucide-react'

export function History() {
  const history = useUserStateStore((s) => s.history)
  const loaded = useUserStateStore((s) => s.loaded)
  const loadHistory = useUserStateStore((s) => s.loadHistory)
  const releases = useReleasesStore((s) => s.releases)

  useEffect(() => {
    if (!loaded) loadHistory()
  }, [loaded, loadHistory])

  const getReleaseTitle = (id: string) => {
    const r = releases.find((r) => r.id === id)
    return r?.title ?? '(deleted release)'
  }

  const getReleaseUrl = (id: string) => {
    const r = releases.find((r) => r.id === id)
    return r?.urlRelease
  }

  const actionStyle = (action: string) => {
    switch (action) {
      case 'opened': return 'bg-accent/20 text-accent'
      case 'favorited':
      case 'unfavorited': return 'bg-red-900/30 text-red-400'
      case 'listened':
      case 'unlistened': return 'bg-green-900/30 text-green-400'
      case 'scrape_completed': return 'bg-blue-900/30 text-blue-400'
      case 'page_detected': return 'bg-cyan-900/30 text-cyan-400'
      case 'batch_action': return 'bg-purple-900/30 text-purple-400'
      default: return 'bg-surface-tertiary text-content-muted'
    }
  }

  const actionLabel = (action: string) => {
    switch (action) {
      case 'opened': return 'Opened'
      case 'favorited': return 'Favorited'
      case 'unfavorited': return 'Unfavorited'
      case 'listened': return 'Listened'
      case 'unlistened': return 'Unlistened'
      case 'link_clicked': return 'Clicked link'
      case 'scrape_completed': return 'Scrape'
      case 'page_detected': return 'Detection'
      case 'batch_action': return 'Batch'
      default: return action
    }
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-content-muted">No history yet. Browse releases to build history.</p>
      </div>
    )
  }

  return (
    <div className="p-6 overflow-auto h-full">
      <h2 className="text-xl font-bold text-content mb-4">History</h2>
      <div className="space-y-1">
        {history.map((entry, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 bg-surface-card rounded-lg text-sm">
            <span className="text-xs text-content-muted w-32 shrink-0">{new Date(entry.timestamp).toLocaleString()}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${actionStyle(entry.action)}`}>
              {actionLabel(entry.action)}
            </span>

            {(() => {
              if (entry.action === 'scrape_completed' || entry.action === 'page_detected') {
                try {
                  const d = JSON.parse(entry.detail ?? '{}')
                  if (entry.action === 'scrape_completed') {
                    const status = d.status === 'completed' ? 'completed' : 'cancelled'
                    return (
                      <span className="flex items-center gap-1.5 truncate text-content-secondary">
                        <span className="text-content-secondary font-medium">{d.genre}</span>
                        <span className="text-[10px] text-cyan-500/70">[{d.adapter}]</span>
                        <span>(pages {d.pages})</span>
                        <span className="text-content-muted">—</span>
                        <span>{d.releases} releases</span>
                        {status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                      </span>
                    )
                  }
                  return (
                    <span className="flex items-center gap-1.5 truncate text-content-secondary">
                      <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-content-secondary font-medium">{d.genre}</span>
                      <span className="text-[10px] text-cyan-500/70">[{d.adapter}]</span>
                      <span>— max</span>
                      <span className="text-cyan-400 font-medium">{d.maxPage}</span>
                      <span className="text-content-muted">pages</span>
                    </span>
                  )
                } catch {
                  return <span className="text-content-muted truncate">{entry.detail}</span>
                }
              }

              if (entry.action === 'batch_action') {
                try {
                  const d = JSON.parse(entry.detail ?? '{}')
                  const modeLabels: Record<string, string> = {
                    download: 'Download',
                    search: 'Search',
                    'mark-listened': 'Mark Listened',
                    'mark-unlistened': 'Mark Unlistened',
                    'mark-favorite': 'Mark Favorite',
                    'mark-unfavorite': 'Mark Unfavorite',
                  }
                  const modeLabel = modeLabels[d.mode] ?? d.mode
                  return (
                    <span className="flex items-center gap-1.5 truncate text-content-secondary">
                      <Play className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="font-medium">{d.count} releases</span>
                      <span className="text-content-muted">→</span>
                      <span>{modeLabel}</span>
                      {d.target && (
                        <>
                          <span className="text-content-muted">:</span>
                          <span className="font-medium">{d.target}</span>
                        </>
                      )}
                      {d.markAsListened && (
                        <span className="text-[10px] text-green-400/60 ml-1">+listened</span>
                      )}
                    </span>
                  )
                } catch {
                  return <span className="text-content-muted truncate">{entry.detail}</span>
                }
              }

              if (entry.action === 'link_clicked') {
                let detailLabel = entry.detail ?? ''
                if (detailLabel.startsWith('download:')) {
                  detailLabel = detailLabel.replace('download:', '')
                } else if (detailLabel.startsWith('search:')) {
                  const linkId = detailLabel.replace('search:', '')
                  const link = findQuickLink(linkId)
                  detailLabel = link?.label ?? linkId
                }
                return (
                  <>
                    <span className="text-content-secondary truncate">{getReleaseTitle(entry.releaseId)}</span>
                    {detailLabel && (
                      <span className="text-xs text-content-muted bg-surface-tertiary px-1.5 py-0.5 rounded shrink-0">
                        {detailLabel}
                      </span>
                    )}
                    {getReleaseUrl(entry.releaseId) && (
                      <a
                        href={getReleaseUrl(entry.releaseId)}
                        target="_blank"
                        rel="noopener"
                        className="text-content-muted hover:text-content-secondary ml-auto"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </>
                )
              }

              return (
                <>
                  <span className="text-content-secondary truncate">{getReleaseTitle(entry.releaseId)}</span>
                  {getReleaseUrl(entry.releaseId) && (
                    <a
                      href={getReleaseUrl(entry.releaseId)}
                      target="_blank"
                      rel="noopener"
                      className="text-content-muted hover:text-content-secondary ml-auto"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </>
              )
            })()}
          </div>
        ))}
      </div>
    </div>
  )
}
