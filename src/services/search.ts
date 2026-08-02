import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import type { Release } from '../types/release'

let fuseInstance: Fuse<Release> | null = null

const FUSE_OPTIONS: IFuseOptions<Release> = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'artists', weight: 0.3 },
    { name: 'label', weight: 0.1 },
    { name: 'catalog', weight: 0.1 },
    { name: 'album', weight: 0.1 },
  ],
  threshold: 0.4,
  distance: 100,
  minMatchCharLength: 2,
  shouldSort: true,
}

export function buildSearchIndex(releases: Release[]) {
  fuseInstance = new Fuse(releases, FUSE_OPTIONS)
  return fuseInstance
}

export function search(query: string): Release[] {
  if (!fuseInstance) return []
  if (!query.trim()) return []
  const results = fuseInstance.search(query)
  return results.map((r) => r.item)
}

export type SortField = 'year' | 'title' | 'label' | 'artist' | 'catalog' | 'scrapeDate'
export type SortDir = 'asc' | 'desc'

export function sortReleases(
  releases: Release[],
  field: SortField,
  dir: SortDir = 'desc',
): Release[] {
  return [...releases].sort((a, b) => {
    let cmp = 0
    switch (field) {
      case 'year':
        cmp = a.year - b.year
        break
      case 'title':
        cmp = a.title.localeCompare(b.title)
        break
      case 'label':
        cmp = a.label.localeCompare(b.label)
        break
      case 'artist':
        cmp = (a.artists[0] ?? '').localeCompare(b.artists[0] ?? '')
        break
      case 'catalog':
        cmp = a.catalog.localeCompare(b.catalog)
        break
      case 'scrapeDate':
        cmp = a.scrapeDate.localeCompare(b.scrapeDate)
        break
    }
    return dir === 'desc' ? -cmp : cmp
  })
}
