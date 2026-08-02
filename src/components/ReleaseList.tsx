import { useRef, useCallback, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Release } from '../types/release'
import type { ScrapeJob } from '../types/scraper'
import { ReleaseCard } from './ReleaseCard'
import { useUserStateStore } from '../stores/user-state'
import { useScraperStore } from '../stores/scraper'
import { useSettingsStore } from '../stores/settings'

interface ReleaseListProps {
  releases: Release[]
  compactView?: boolean
  highlightCount?: number
  selectionMode?: boolean
  selectedIds?: Set<string>
  onToggleSelection?: (id: string) => void
}

const LOAD_THRESHOLD = 260

export function ReleaseList({ releases, compactView = false, highlightCount, selectionMode, selectedIds, onToggleSelection }: ReleaseListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const states = useUserStateStore((s) => s.states)
  const loadState = useUserStateStore((s) => s.loadState)
  const jobs = useScraperStore((s) => s.jobs)
  const itemsPerPage = useSettingsStore((s) => s.settings.itemsPerPage)
  const [visibleCount, setVisibleCount] = useState(() => Math.min(releases.length, Math.max(1, itemsPerPage)))

  const visibleReleases = releases.slice(0, visibleCount)

  const virtualizer = useVirtualizer({
    count: visibleReleases.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 140, []),
    measureElement: useCallback((el: HTMLElement) => el.getBoundingClientRect().height, []),
    overscan: 10,
  })

  useEffect(() => {
    const nextCount = Math.min(releases.length, Math.max(1, itemsPerPage))
    setVisibleCount(nextCount)
    if (parentRef.current) {
      parentRef.current.scrollTop = 0
    }
  }, [releases.length, itemsPerPage])

  useEffect(() => {
    visibleReleases.slice(0, 20).forEach((r) => {
      if (!states[r.id]) loadState(r.id)
    })
  }, [visibleReleases, states, loadState])

  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return

    const handleScroll = () => {
      const distanceFromBottom = parent.scrollHeight - (parent.scrollTop + parent.clientHeight)
      if (distanceFromBottom <= LOAD_THRESHOLD && visibleCount < releases.length) {
        setVisibleCount((current) => Math.min(releases.length, current + Math.max(1, itemsPerPage)))
      }
    }

    parent.addEventListener('scroll', handleScroll, { passive: true })
    return () => parent.removeEventListener('scroll', handleScroll)
  }, [itemsPerPage, releases.length, visibleCount])

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const release = visibleReleases[virtualItem.index]

          return (
            <div
              key={release.id}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="px-4 py-0.5"
            >
              <ReleaseCard
                release={release}
                compact={compactView}
                state={states[release.id]}
                selected={!selectionMode && highlightCount != null && virtualItem.index < highlightCount}
                selectionMode={selectionMode}
                checkSelected={selectedIds?.has(release.id)}
                onToggleSelection={onToggleSelection ? () => onToggleSelection(release.id) : undefined}
                jobs={release.scrapeJobIds.map((id) => jobs.find((j) => j.id === id)).filter((j): j is ScrapeJob => j != null)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
