import { create } from 'zustand'
import type { Release } from '../types/release'
import { buildSearchIndex, search, sortReleases, type SortField, type SortDir } from '../services/search'
import { getAllReleases, saveAllReleases, clearReleases } from '../storage/db'
import { useUserStateStore } from './user-state'
import { buildReleaseIdentityIndex, findExistingReleaseId, getReleaseIdentityCandidates } from '../services/release-identity'

export interface FilterState {
  listened: boolean
  unlistened: boolean
  favorite: boolean
  scrapeJobId: string | null
  source: string | null
}

const defaultFilter: FilterState = {
  listened: false,
  unlistened: false,
  favorite: false,
  scrapeJobId: null,
  source: null,
}

interface MergeResult {
  newCount: number
  updatedCount: number
}

interface ReleasesState {
  releases: Release[]
  filtered: Release[]
  loading: boolean
  loaded: boolean
  initialized: boolean
  error: string | null
  searchQuery: string
  sortField: SortField
  sortDir: SortDir
  filterState: FilterState
  selectionMode: boolean
  selectedIds: Set<string>

  initFromDb: () => Promise<void>
  loadReleases: (data: Release[], scrapeJobId?: string, skipExisting?: boolean) => Promise<MergeResult>
  clearAll: () => Promise<void>
  setSearchQuery: (query: string) => void
  setSort: (field: SortField, dir?: SortDir) => void
  setFilter: (partial: Partial<FilterState>) => void
  setSelectionMode: (mode: boolean) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  selectReleases: (criteria: string) => void
}

function mergeDownloads(
  existing: Release,
  incoming: Release,
  scrapeJobId?: string,
): Release {
  const existingUrls = new Set(existing.downloads.map((d) => d.url))
  const newDownloads = incoming.downloads.filter((d) => !existingUrls.has(d.url))
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    stableIdentity: existing.stableIdentity ?? incoming.stableIdentity ?? existing.id,
    downloads: [...existing.downloads, ...newDownloads],
    scrapeJobIds: scrapeJobId
      ? [...new Set([...existing.scrapeJobIds, scrapeJobId])]
      : existing.scrapeJobIds,
    scrapeDate: new Date().toISOString(),
  }
}

function applyFilters(
  releases: Release[],
  filterState: FilterState,
): Release[] {
  const states = useUserStateStore.getState().states
  let result = releases

  if (filterState.listened) {
    result = result.filter((r) => states[r.id]?.listenStatus === 'listened')
  }
  if (filterState.unlistened) {
    result = result.filter((r) => (states[r.id]?.listenStatus ?? 'unlistened') !== 'listened')
  }
  if (filterState.favorite) {
    result = result.filter((r) => states[r.id]?.favorite === true)
  }
  if (filterState.scrapeJobId) {
    result = result.filter((r) => r.scrapeJobIds.includes(filterState.scrapeJobId!))
  }
  if (filterState.source) {
    result = result.filter((r) => r.source === filterState.source)
  }

  return result
}

export const useReleasesStore = create<ReleasesState>((set, get) => ({
  releases: [],
  filtered: [],
  loading: false,
  loaded: false,
  initialized: false,
  error: null,
  searchQuery: '',
  sortField: 'year',
  sortDir: 'desc',
  filterState: { ...defaultFilter },
  selectionMode: false,
  selectedIds: new Set(),

  initFromDb: async () => {
    try {
      const persisted = await getAllReleases()
      if (persisted.length > 0) {
        buildSearchIndex(persisted)
        const { sortField, sortDir, filterState } = get()
        const sorted = sortReleases(persisted, sortField, sortDir)
        const filtered = applyFilters(sorted, filterState)
        set({
          releases: persisted,
          filtered,
          loaded: true,
          initialized: true,
        })
      } else {
        set({ initialized: true })
      }
    } catch (e) {
      set({ initialized: true, error: (e as Error).message })
    }
  },

  loadReleases: async (data: Release[], scrapeJobId?: string, skipExisting?: boolean) => {
    set({ loading: true })
    let newCount = 0
    let updatedCount = 0
    try {
      const incoming: Release[] = data.map((r) => ({
        id: r.id,
        stableIdentity: r.stableIdentity,
        source: r.source ?? '',
        title: r.title ?? '',
        artists: r.artists ?? [],
        album: r.album ?? '',
        label: r.label ?? '',
        catalog: r.catalog ?? '',
        year: r.year ?? 0,
        genre: r.genre ?? '',
        subgenres: r.subgenres ?? [],
        urlRelease: r.urlRelease ?? '',
        coverUrl: r.coverUrl ?? null,
        scrapeDate: new Date().toISOString(),
        scrapeJobIds: scrapeJobId
          ? [...new Set([...(r.scrapeJobIds ?? []), scrapeJobId])]
          : (r.scrapeJobIds ?? []),
        downloads: r.downloads ?? [],
      }))

      const { releases: prevReleases } = get()
      const existing = new Map(prevReleases.map((r) => [r.id, r]))
      const identityIndex = buildReleaseIdentityIndex(prevReleases)

      const registerIdentity = (release: Release) => {
        for (const candidate of getReleaseIdentityCandidates(release)) {
          identityIndex.set(candidate, release.id)
        }
      }

      for (const r of incoming) {
        const prevId = findExistingReleaseId(identityIndex, r)
        const prev = prevId ? existing.get(prevId) : undefined
        if (prev) {
          if (skipExisting) {
            continue
          }
          const merged = mergeDownloads(prev, r, scrapeJobId)
          existing.set(prev.id, merged)
          registerIdentity(merged)
          updatedCount++
        } else {
          existing.set(r.id, r)
          registerIdentity(r)
          newCount++
        }
      }

      const merged = Array.from(existing.values())
      buildSearchIndex(merged)

      const { sortField, sortDir, filterState } = get()
      const sorted = sortReleases(merged, sortField, sortDir)
      const filtered = applyFilters(sorted, filterState)

      set({ releases: merged, filtered, loading: false, loaded: true, error: null })
      await saveAllReleases(merged)
      return { newCount, updatedCount }
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
      return { newCount: 0, updatedCount: 0 }
    }
  },

  clearAll: async () => {
    await clearReleases()
    set({ releases: [], filtered: [], loaded: false, initialized: true, loading: false, searchQuery: '', error: null, filterState: { ...defaultFilter }, selectedIds: new Set() })
  },

  setSearchQuery: (query: string) => {
    const { releases, sortField, sortDir, filterState } = get()
    set({ searchQuery: query, selectedIds: new Set() })
    let result: Release[]
    if (!query.trim()) {
      result = [...releases]
    } else {
      result = search(query)
    }
    const filtered = applyFilters(result, filterState)
    set({ filtered: sortReleases(filtered, sortField, sortDir) })
  },

  setSort: (field: SortField, dir?: SortDir) => {
    const { filtered } = get()
    const newDir = dir ?? (get().sortField === field && get().sortDir === 'desc' ? 'asc' : 'desc')
    set({ sortField: field, sortDir: newDir, filtered: sortReleases(filtered, field, newDir) })
  },

  setFilter: (partial: Partial<FilterState>) => {
    const { releases, searchQuery, sortField, sortDir, filterState } = get()
    const nextFilter = { ...filterState, ...partial }
    set({ filterState: nextFilter, selectedIds: new Set() })
    let result: Release[]
    if (searchQuery.trim()) {
      result = search(searchQuery)
    } else {
      result = [...releases]
    }
    const filtered = applyFilters(result, nextFilter)
    set({ filtered: sortReleases(filtered, sortField, sortDir) })
  },

  setSelectionMode: (mode: boolean) => set({ selectionMode: mode }),
  
  toggleSelection: (id: string) => {
    const { selectedIds } = get()
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    set({ selectedIds: next })
  },
  
  clearSelection: () => set({ selectedIds: new Set() }),
  
  selectReleases: (criteria: string) => {
    const { filtered } = get()
    const states = useUserStateStore.getState().states
    let ids: Set<string>
    if (!criteria) {
      ids = new Set()
    } else if (criteria === '__all__') {
      ids = new Set(filtered.map((r) => r.id))
    } else if (criteria === 'listened') {
      ids = new Set(filtered.filter((r) => states[r.id]?.listenStatus === 'listened').map((r) => r.id))
    } else if (criteria === 'unlistened') {
      ids = new Set(filtered.filter((r) => (states[r.id]?.listenStatus ?? 'unlistened') !== 'listened').map((r) => r.id))
    } else if (criteria === 'favorite') {
      ids = new Set(filtered.filter((r) => states[r.id]?.favorite === true).map((r) => r.id))
    } else if (criteria === 'unfavorite') {
      ids = new Set(filtered.filter((r) => !states[r.id]?.favorite).map((r) => r.id))
    } else {
      ids = new Set(filtered.filter((r) => r.scrapeJobIds.includes(criteria)).map((r) => r.id))
    }
    set({ selectedIds: ids })
  },
}))
