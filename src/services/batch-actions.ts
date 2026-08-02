import type { Release } from '../types/release'
import type { ListenStatus, HistoryEntry } from '../types/user-state'
import { findQuickLink, buildSearchQuery } from './links'

export type BatchAction =
  | { type: 'download'; host: string }
  | { type: 'search'; linkId: string }
  | { type: 'mark-listened' }
  | { type: 'mark-unlistened' }
  | { type: 'mark-favorite' }
  | { type: 'mark-unfavorite' }

export interface UrlEntry {
  url: string
  releaseId: string
}

export function collectUrls(releases: Release[], count: number, action: BatchAction): UrlEntry[] {
  const entries: UrlEntry[] = []
  const targetHost = action.type === 'download' ? normalizeHostDisplay(action.host) : ''

  for (const r of releases) {
    if (entries.length >= count) break
    if (action.type === 'download') {
      const dl = r.downloads.find((d) => normalizeHostDisplay(d.host) === targetHost)
      if (dl) entries.push({ url: dl.url, releaseId: r.id })
    } else if (action.type === 'search') {
      const link = findQuickLink(action.linkId)
      if (link) entries.push({ url: link.url(buildSearchQuery(r)), releaseId: r.id })
    }
  }
  return entries
}

export function getUniqueHosts(releases: Release[]): string[] {
  const hosts = new Set<string>()
  for (const r of releases) {
    for (const d of r.downloads) {
      if (d.host) hosts.add(d.host)
    }
  }
  return Array.from(hosts).sort()
}

/**
 * Visual-only normalization: strips protocol/www, capitalises first letter.
 * The raw `host` value is still used for data matching.
 */
export function normalizeHostDisplay(host: string): string {
  let h = host.trim()
  h = h.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
  if (h.length > 0 && h === h.toLowerCase()) {
    h = h.charAt(0).toUpperCase() + h.slice(1)
  }
  return h
}

/**
 * Returns every unique host found in the releases together with how many
 * releases carry a download for that host, sorted by count descending.
 */
export function getHostsWithCount(
  releases: Release[],
): { host: string; displayName: string; count: number }[] {
  const map = new Map<string, number>()
  for (const r of releases) {
    for (const d of r.downloads) {
      if (d.host) {
        const norm = normalizeHostDisplay(d.host)
        if (norm) {
          map.set(norm, (map.get(norm) ?? 0) + 1)
        }
      }
    }
  }
  return Array.from(map.entries())
    .map(([displayName, count]) => ({ host: displayName, displayName, count }))
    .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName))
}

export async function openSequentially(
  entries: UrlEntry[],
  delayMs: number,
  signal: AbortSignal,
  onProgress: (opened: number, total: number) => void,
  onEachOpen?: (releaseId: string) => void,
): Promise<void> {
  const windows: (Window | null)[] = []
  for (let i = 0; i < entries.length; i++) {
    if (signal.aborted) break
    windows.push(window.open('', '_blank'))
  }

  onProgress(windows.length, entries.length)

  for (let i = 0; i < entries.length; i++) {
    if (signal.aborted) break

    const entry = entries[i]
    const w = windows[i]
    if (w && !w.closed) {
      w.location.href = entry.url
    } else {
      window.open(entry.url, '_blank', 'noopener')
    }
    onEachOpen?.(entry.releaseId)

    if (i < entries.length - 1) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delayMs)
        signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
      })
    }
  }
}

export async function executeBatchStateAction(
  releases: Release[],
  count: number,
  action: BatchAction,
  callbacks: {
    setListenStatus: (id: string, status: ListenStatus) => void
    toggleFavorite: (id: string) => void
    logAction: (releaseId: string, action: HistoryEntry['action'], detail?: string) => void
  },
  onProgress?: (done: number, total: number) => void,
): Promise<{ actioned: number }> {
  let done = 0
  for (const r of releases) {
    if (done >= count) break
    if (action.type === 'mark-listened') {
      callbacks.setListenStatus(r.id, 'listened')
      callbacks.logAction(r.id, 'listened')
    } else if (action.type === 'mark-unlistened') {
      callbacks.setListenStatus(r.id, 'unlistened')
      callbacks.logAction(r.id, 'unlistened')
    } else if (action.type === 'mark-favorite') {
      callbacks.toggleFavorite(r.id)
      callbacks.logAction(r.id, 'favorited')
    } else if (action.type === 'mark-unfavorite') {
      callbacks.toggleFavorite(r.id)
      callbacks.logAction(r.id, 'unfavorited')
    }
    done++
    onProgress?.(done, count)
  }
  return { actioned: done }
}
