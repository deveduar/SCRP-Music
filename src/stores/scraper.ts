import { create } from 'zustand'
import type { Release } from '../types/release'
import type { Genre, ScrapeProgress, ScrapeJob } from '../types/scraper'
import type { ScraperAdapter, ScrapeAdapterOptions } from '../types/adapter'
import { useReleasesStore } from './releases'
import { useUserStateStore } from './user-state'
import { clear as clearDb, saveJob, getJobs } from '../storage/db'
import { registerAdapterLinks } from '../services/links'
import { buildReleaseIdentityIndex, findExistingReleaseId } from '../services/release-identity'

interface ScraperState {
  adapters: Record<string, ScraperAdapter>
  activeAdapterId: string | null
  adapter: ScraperAdapter | null
  running: boolean
  paused: boolean
  currentGenre: Genre | null
  currentOptions: ScrapeAdapterOptions | null
  progress: ScrapeProgress | null
  results: Release[]
  log: string[]
  currentJobId: string | null
  jobs: ScrapeJob[]

  registerAdapter: (adapter: ScraperAdapter) => void
  setActiveAdapter: (id: string) => void
  detectPages: (genreId: string, proxyUrl: string) => Promise<number | null>
  start: (genre: Genre, options: ScrapeAdapterOptions, autoLoad?: boolean, skipExisting?: boolean) => Promise<void>
  pause: () => void
  resume: () => void
  cancel: () => void
  clear: () => void
  resetAll: () => Promise<void>
  loadJobs: () => Promise<void>
}

let abortController: AbortController | null = null
let isPaused = false

function generateJobId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export const useScraperStore = create<ScraperState>((set, get) => ({
  adapters: {},
  activeAdapterId: null,
  adapter: null,
  running: false,
  paused: false,
  currentGenre: null,
  currentOptions: null,
  progress: null,
  results: [],
  log: [],
  currentJobId: null,
  jobs: [],

  registerAdapter: (adapter) => {
    const adapters = { ...get().adapters, [adapter.id]: adapter }
    const state = get()
    const shouldActivate = !state.activeAdapterId || state.activeAdapterId === adapter.id
    registerAdapterLinks(adapter.id, adapter.getSearchLinks())
    set({
      adapters,
      ...(shouldActivate ? { adapter, activeAdapterId: adapter.id } : {}),
    })
  },

  setActiveAdapter: (id) => {
    const adapter = get().adapters[id]
    if (!adapter) return
    if (get().running) {
      if (abortController) {
        abortController.abort()
        abortController = null
      }
      isPaused = false
    }
    set({
      activeAdapterId: id,
      adapter,
      running: false,
      paused: false,
      currentGenre: null,
      currentOptions: null,
      progress: null,
      results: [],
      log: [],
      currentJobId: null,
    })
  },

  detectPages: async (genreId, proxyUrl) => {
    const adapter = get().adapter
    if (!adapter) return null
    try {
      const max = await adapter.detectMaxPages(genreId, { proxyUrl })
      const genre = adapter.getGenres().find((g) => g.id === genreId)
      await useUserStateStore.getState().logAction('', 'page_detected', JSON.stringify({
        genre: genre?.label ?? genreId,
        adapter: adapter.name,
        maxPage: max,
      }))
      return max
    } catch {
      return null
    }
  },

  start: async (genre, options, autoLoad = true, skipExisting = false) => {
    const state = get()
    if (!state.adapter || state.running) return

    abortController = new AbortController()
    isPaused = false

    const jobId = generateJobId()

    set({
      running: true,
      paused: false,
      currentGenre: genre,
      currentOptions: options,
      results: [],
      log: [],
      progress: null,
      currentJobId: jobId,
    })

    const addLog = (msg: string) => {
      set((s) => ({ log: [...s.log, `[${new Date().toLocaleTimeString()}] ${msg}`] }))
    }

    let totalReleases = 0
    let totalSkipped = 0
    const existingIdentityIndex = buildReleaseIdentityIndex(useReleasesStore.getState().releases)

    try {
      await state.adapter.scrape(
        options,
        {
          onProgress: (p) => set({ progress: { ...p } }),
          onPageDone: (page, count, skipped = 0) => {
            const skippedText = skipped > 0 ? `, ${skipped} skipped existing` : ''
            addLog(`Page ${page} done — ${count} releases found${skippedText}`)
          },
          onReleaseDone: (release) => {
            set((s) => ({ results: [...s.results, release] }))
            totalReleases++
          },
          onReleaseSkipped: () => {
            totalSkipped++
          },
          shouldSkipExistingRelease: (candidate) => {
            if (!options.fastSkipExisting) return false
            return Boolean(findExistingReleaseId(existingIdentityIndex, candidate))
          },
          onError: (msg) => addLog(`ERROR: ${msg}`),
          onComplete: async (results) => {
            const skippedText = totalSkipped > 0 ? `, ${totalSkipped} skipped existing` : ''
            addLog(`Scraping complete! ${results.length} releases total${skippedText}`)
            set({ running: false, paused: false, currentGenre: null, currentOptions: null })

          let newCount = 0
          let updatedCount = 0

          if (autoLoad && results.length > 0) {
            addLog('Auto-loading results into release browser...')
            const mergeResult = await useReleasesStore.getState().loadReleases(results, jobId, skipExisting)
            newCount = mergeResult.newCount
            updatedCount = mergeResult.updatedCount
            addLog(`Loaded! ${newCount} new, ${updatedCount} updated`)
          }

          const job: ScrapeJob = {
            id: jobId,
            adapterId: get().adapter?.id ?? '',
            adapterName: get().adapter?.name ?? '',
            genre: genre,
            startPage: options.startPage,
            endPage: options.endPage,
            delayPage: options.delayPage,
            delayRelease: options.delayRelease,
            status: 'completed',
            totalReleases: results.length,
            newReleases: newCount,
            updatedReleases: updatedCount,
            date: new Date().toISOString(),
          }
          await saveJob(job)
          set((s) => ({ jobs: [job, ...s.jobs] }))

          await useUserStateStore.getState().logAction('', 'scrape_completed', JSON.stringify({
            genre: genre.label,
            adapter: get().adapter?.name ?? '',
            pages: `${options.startPage}-${options.endPage}`,
            releases: results.length,
            newReleases: newCount,
            updatedReleases: updatedCount,
            status: 'completed',
          }))
        },
      },
      abortController.signal,
      () => isPaused,
    )
    } catch (err) {
      addLog(`FATAL: ${(err as Error).message}`)
      set({ running: false, paused: false, currentGenre: null, currentOptions: null })
    }
  },

  pause: () => {
    isPaused = true
    set({ paused: true })
  },

  resume: () => {
    isPaused = false
    set({ paused: false })
  },

  cancel: async () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    isPaused = false
    const state = get()
    set({ running: false, paused: false })
    const genre = state.currentGenre
    const opts = state.currentOptions

    if (genre && state.currentJobId) {
      const job: ScrapeJob = {
        id: state.currentJobId,
        adapterId: get().adapter?.id ?? '',
        adapterName: get().adapter?.name ?? '',
        genre,
        startPage: opts?.startPage ?? 0,
        endPage: opts?.endPage ?? 0,
        delayPage: opts?.delayPage ?? 0,
        delayRelease: opts?.delayRelease ?? 0,
        status: 'cancelled',
        totalReleases: state.results.length,
        newReleases: 0,
        updatedReleases: 0,
        date: new Date().toISOString(),
      }
      await saveJob(job)
      set((s) => ({ jobs: [job, ...s.jobs], currentGenre: null, currentOptions: null }))

      await useUserStateStore.getState().logAction('', 'scrape_completed', JSON.stringify({
        genre: genre.label,
        adapter: get().adapter?.name ?? '',
        pages: 'cancelled',
        releases: state.results.length,
        status: 'cancelled',
      }))
    }
  },

  clear: () => {
    set({ results: [], log: [], progress: null })
  },

  resetAll: async () => {
    await clearDb()
    for (const a of Object.values(get().adapters)) {
      a.clearCache()
    }
    localStorage.removeItem('batch_action_bar')
    localStorage.removeItem('batch_selection_mode')
    localStorage.removeItem('batch_selected_ids')
    set({ results: [], log: [], progress: null, jobs: [] })
    useReleasesStore.getState().clearAll()
    useUserStateStore.getState().resetAll()
    window.location.reload()
  },

  loadJobs: async () => {
    const jobs = await getJobs()
    set({ jobs })
  },
}))
