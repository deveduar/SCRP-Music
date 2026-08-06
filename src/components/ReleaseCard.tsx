import { memo, useCallback, useState } from 'react'
import type { Release } from '../types/release'
import type { UserReleaseState } from '../types/user-state'
import type { ScrapeJob } from '../types/scraper'
import { Heart, Download, CheckCircle, Circle, ImageOff, CheckSquare } from 'lucide-react'
import { useUserStateStore } from '../stores/user-state'
import { getAllQuickLinks, findQuickLink, buildSearchQuery } from '../services/links'
import { YouTubeButton } from './YouTubeButton'

interface ReleaseCardProps {
  release: Release
  state?: UserReleaseState
  compact?: boolean
  selected?: boolean
  selectionMode?: boolean
  checkSelected?: boolean
  onToggleSelection?: () => void
  jobs?: ScrapeJob[]
}

export const ReleaseCard = memo(function ReleaseCard({ release, state, compact = false, selected, selectionMode, checkSelected, onToggleSelection, jobs }: ReleaseCardProps) {
  const { toggleFavorite, setListenStatus, logAction } = useUserStateStore()
  const [coverError, setCoverError] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleOpenLink = useCallback((url: string, action?: string) => {
    window.open(url, '_blank', 'noopener')
    if (action) logAction(release.id, 'link_clicked', action)
  }, [release.id, logAction])

  const handleQuickSearch = useCallback((linkId: string) => {
    const link = findQuickLink(linkId)
    if (!link) return
    const query = buildSearchQuery(release)
    window.open(link.url(query), '_blank', 'noopener')
    logAction(release.id, 'link_clicked', `search:${linkId}`)
  }, [release, logAction])

  const handleToggleDetails = useCallback(() => {
    setIsExpanded((current) => {
      const next = !current
      if (next) logAction(release.id, 'opened', release.title)
      return next
    })
  }, [release.id, release.title, logAction])

  const handleOpenRelease = useCallback(() => {
    window.open(release.urlRelease, '_blank', 'noopener')
    logAction(release.id, 'opened', release.title)
  }, [release.id, release.title, release.urlRelease, logAction])

  const handleClickRelease = useCallback(() => {
    if (compact) {
      handleToggleDetails()
      return
    }

    handleOpenLink(release.urlRelease)
    logAction(release.id, 'opened', release.title)
  }, [compact, handleToggleDetails, handleOpenLink, release.id, release.title, release.urlRelease, logAction])

  const isFavorite = state?.favorite ?? false
  const listenStatus = state?.listenStatus ?? 'unlistened'
  const compactMeta = [
    release.artists.join(', '),
    release.label,
    release.catalog,
    release.year ? String(release.year) : '',
    new Date(release.scrapeDate).toLocaleDateString(),
    release.genre,
    release.source,
  ].filter(Boolean).join(' • ')

  const borderClass = selectionMode
    ? checkSelected
      ? 'border-accent'
      : 'border-border-main'
    : selected
      ? 'border-accent/60'
      : 'border-border-main'

  return (
    <div className={`group bg-surface-card border rounded-lg p-2 hover:bg-surface-card-hover transition-colors ${borderClass}`}>
      <div className={`flex gap-2.5 ${compact ? 'items-center' : ''}`}>
        {selectionMode && (
          <button
            onClick={onToggleSelection}
            className="shrink-0 self-center w-5 h-5 flex items-center justify-center cursor-pointer"
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              checkSelected
                ? 'bg-accent border-accent'
                : 'border-content-muted/50 hover:border-content-secondary'
            }`}>
              {checkSelected && (
                <CheckSquare className="w-3 h-3 text-white" />
              )}
            </div>
          </button>
        )}

        {release.coverUrl && !compact && (
          <div className="shrink-0">
            {!coverError ? (
              <img
                src={release.coverUrl}
                alt={release.title}
                className="w-12 h-12 object-cover rounded bg-surface-secondary"
                loading="lazy"
                onError={() => setCoverError(true)}
              />
            ) : (
              <div className="w-12 h-12 flex items-center justify-center bg-surface-secondary rounded">
                <ImageOff className="w-5 h-5 text-content-muted" />
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {compact ? (
            <div className="flex items-center justify-between gap-2">
              <button onClick={handleClickRelease} className="text-left flex-1 min-w-0 cursor-pointer">
                <span className="block text-sm text-content truncate hover:text-accent transition-colors">
                  {compactMeta || release.title}
                </span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { logAction(release.id, isFavorite ? 'unfavorited' : 'favorited'); toggleFavorite(release.id) }}
                  className={`p-1 rounded-md cursor-pointer transition-colors ${
                    isFavorite ? 'text-red-400 hover:text-red-300' : 'text-content-muted hover:text-content-secondary'
                  }`}
                  title={isFavorite ? 'Unfavorite' : 'Favorite'}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={() => {
                    const next = listenStatus === 'listened' ? 'unlistened' : 'listened'
                    logAction(release.id, next === 'listened' ? 'listened' : 'unlistened')
                    setListenStatus(release.id, next)
                  }}
                  className={`p-1 rounded-md cursor-pointer transition-colors ${
                    listenStatus === 'listened' ? 'text-green-400 hover:text-green-300' : 'text-content-muted hover:text-content-secondary'
                  }`}
                  title={listenStatus === 'listened' ? 'Mark unlistened' : 'Mark listened'}
                >
                  {listenStatus === 'listened' ? <CheckCircle className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={handleToggleDetails}
                  className="px-2 py-1 text-xs bg-surface-tertiary text-content-secondary rounded hover:bg-border-light hover:text-content cursor-pointer transition-colors"
                >
                  {isExpanded ? 'Hide' : 'Details'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <button onClick={handleClickRelease} className="text-left w-full min-w-0 cursor-pointer">
                  <h3 className="text-sm font-medium text-content truncate hover:text-accent transition-colors">
                    {release.title}
                  </h3>
                </button>
                <p className="text-xs text-content-muted mt-0.5 truncate">
                  {release.artists.join(', ')}{release.label ? ` • ${release.label}` : ''}{release.catalog ? ` • ${release.catalog}` : ''}{release.year ? ` • ${release.year}` : ''}
                  <span className="ml-2 text-[10px] text-content-muted/60">
                    {new Date(release.scrapeDate).toLocaleDateString()}
                    {jobs && jobs.length > 0 && (
                      <span className="ml-1 text-cyan-400/70">{jobs[0].genre.label}</span>
                    )}
                    <span className="ml-2 px-1.5 py-0.5 bg-surface-tertiary border border-border-main text-content-secondary rounded font-medium truncate max-w-[80px] inline-block align-middle">{release.source}</span>
                    {release.scrapeJobIds.length > 1 && (
                      <span className="ml-1 text-cyan-500/60">+{release.scrapeJobIds.length - 1}</span>
                    )}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { logAction(release.id, isFavorite ? 'unfavorited' : 'favorited'); toggleFavorite(release.id) }}
                  className={`p-1 rounded-md cursor-pointer transition-colors ${
                    isFavorite ? 'text-red-400 hover:text-red-300' : 'text-content-muted hover:text-content-secondary'
                  }`}
                  title={isFavorite ? 'Unfavorite' : 'Favorite'}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={() => {
                    const next = listenStatus === 'listened' ? 'unlistened' : 'listened'
                    logAction(release.id, next === 'listened' ? 'listened' : 'unlistened')
                    setListenStatus(release.id, next)
                  }}
                  className={`p-1 rounded-md cursor-pointer transition-colors ${
                    listenStatus === 'listened' ? 'text-green-400 hover:text-green-300' : 'text-content-muted hover:text-content-secondary'
                  }`}
                  title={listenStatus === 'listened' ? 'Mark unlistened' : 'Mark listened'}
                >
                  {listenStatus === 'listened' ? <CheckCircle className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {!compact && release.downloads.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {release.downloads.map((d, i) => (
                <button
                  key={i}
                  onClick={() => handleOpenLink(d.url, `download:${d.host}`)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-surface-tertiary text-content-secondary rounded hover:bg-border-light hover:text-content cursor-pointer transition-colors"
                  title={d.url}
                >
                  <Download className="w-3 h-3" />
                  {d.host.replace(/\.(com|net|co)$/, '')}
                </button>
              ))}
            </div>
          )}

          {!compact && (
            <div className="flex flex-wrap gap-1 mt-1">
              {getAllQuickLinks(release.source).map((link) => (
                <button
                  key={link.id}
                  onClick={() => handleQuickSearch(link.id)}
                  className="text-xs px-1.5 py-0.5 bg-surface-tertiary/50 text-content-muted rounded hover:bg-surface-tertiary hover:text-content-secondary cursor-pointer transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </div>
          )}

          {!compact && (
            <div className="mt-1">
              <YouTubeButton release={release} />
            </div>
          )}

          {!compact && state?.notes && (
            <p className="text-xs text-content-muted mt-1 italic line-clamp-2">{state.notes}</p>
          )}

          {compact && isExpanded && (
            <div className="mt-2 border-t border-border-main/70 pt-2 space-y-2">
              <div className="flex items-start gap-2">
                {release.coverUrl && (
                  <div className="shrink-0">
                    {!coverError ? (
                      <img
                        src={release.coverUrl}
                        alt={release.title}
                        className="w-12 h-12 object-cover rounded bg-surface-secondary"
                        loading="lazy"
                        onError={() => setCoverError(true)}
                      />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center bg-surface-secondary rounded">
                        <ImageOff className="w-5 h-5 text-content-muted" />
                      </div>
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <button onClick={handleOpenRelease} className="text-left w-full min-w-0 cursor-pointer">
                    <h3 className="text-sm font-medium text-content hover:text-accent transition-colors">{release.title}</h3>
                  </button>
                  <p className="text-xs text-content-muted mt-0.5">
                    {release.artists.join(', ')}{release.label ? ` • ${release.label}` : ''}{release.catalog ? ` • ${release.catalog}` : ''}{release.year ? ` • ${release.year}` : ''}
                    <span className="ml-2 text-[10px] text-content-muted/60">
                      {new Date(release.scrapeDate).toLocaleDateString()}
                      {jobs && jobs.length > 0 && (
                        <span className="ml-1 text-cyan-400/70">{jobs[0].genre.label}</span>
                      )}
                      <span className="ml-2 px-1.5 py-0.5 bg-surface-tertiary border border-border-main text-content-secondary rounded font-medium truncate max-w-[80px] inline-block align-middle">{release.source}</span>
                      {release.scrapeJobIds.length > 1 && (
                        <span className="ml-1 text-cyan-500/60">+{release.scrapeJobIds.length - 1}</span>
                      )}
                    </span>
                  </p>
                </div>
              </div>

              {release.downloads.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {release.downloads.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => handleOpenLink(d.url, `download:${d.host}`)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-surface-tertiary text-content-secondary rounded hover:bg-border-light hover:text-content cursor-pointer transition-colors"
                      title={d.url}
                    >
                      <Download className="w-3 h-3" />
                      {d.host.replace(/\.(com|net|co)$/, '')}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                {getAllQuickLinks(release.source).map((link) => (
                  <button
                    key={link.id}
                    onClick={() => handleQuickSearch(link.id)}
                    className="text-xs px-1.5 py-0.5 bg-surface-tertiary/50 text-content-muted rounded hover:bg-surface-tertiary hover:text-content-secondary cursor-pointer transition-colors"
                  >
                    {link.label}
                  </button>
                ))}
              </div>

              <div>
                <YouTubeButton release={release} />
              </div>

              {state?.notes && (
                <p className="text-xs text-content-muted italic">{state.notes}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
