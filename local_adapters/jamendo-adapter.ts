import type { Genre, ScrapeProgress } from '../src/types/scraper'
import type { Release, Download } from '../src/types/release'
import type { ScraperAdapter, ScrapeAdapterOptions, ScrapeAdapterCallbacks } from '../src/types/adapter'
import { MUSIC_LINKS } from './shared'
import { useSettingsStore } from '../src/stores/settings'

const BASE = 'https://www.jamendo.com'
const API_BASE = 'https://api.jamendo.com/v3.0'
const PAGE_LIMIT_CACHE_KEY = 'jamendo_page_limits'
const PAGE_SIZE = 200

interface PageLimitEntry {
  maxPage: number
  detectedAt: string
}

interface JamendoTrack {
  id: string
  name: string
  album_name: string
  album_id: string
  artist_name: string
  releasedate: string
  album_image: string
  audiodownload: string
}

interface JamendoResponse {
  headers: {
    status: string
    code: number
    error_message?: string
    results_count: number
    results_fullcount: number
  }
  results: JamendoTrack[]
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function checkPaused(isPaused: () => boolean): Promise<void> {
  while (isPaused()) {
    await delay(500)
  }
}

async function sha1(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hash = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function loadPageLimitCache(): Record<string, PageLimitEntry> {
  try {
    const raw = JSON.parse(localStorage.getItem(PAGE_LIMIT_CACHE_KEY) || '{}')
    const result: Record<string, PageLimitEntry> = {}
    for (const [key, val] of Object.entries(raw)) {
      if (typeof val === 'number') {
        result[key] = { maxPage: val, detectedAt: new Date().toISOString() }
      } else {
        result[key] = val as PageLimitEntry
      }
    }
    return result
  } catch {
    return {}
  }
}

function savePageLimitCache(limits: Record<string, PageLimitEntry>) {
  localStorage.setItem(PAGE_LIMIT_CACHE_KEY, JSON.stringify(limits))
}

function requireKey(): string {
  const state = useSettingsStore.getState()
  const key = state.settings.apiKeys?.jamendo
  if (!key) {
    const keys = state.settings.apiKeys ?? {}
    if (typeof window !== 'undefined') {
      console.warn('[JamendoAdapter] apiKeys store state:', JSON.stringify(keys))
    }
    throw new Error(
      'Jamendo requires an API key. Get one for free at https://devportal.jamendo.com ' +
      'and add it in Settings \u2192 API Keys as "jamendo".'
    )
  }
  return key
}

function apiUrl(genreId: string, page: number, clientId: string): string {
  const offset = (page - 1) * PAGE_SIZE
  return `${API_BASE}/tracks?client_id=${clientId}&format=json&limit=${PAGE_SIZE}&offset=${offset}&tags=${genreId}&groupby=album_id&fullcount=true`
}

function apiUrlCount(genreId: string, clientId: string): string {
  return `${API_BASE}/tracks?client_id=${clientId}&format=json&limit=1&tags=${genreId}&groupby=album_id&fullcount=true`
}

const FETCH_TIMEOUT = 30_000

function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort(sig.reason)
      return controller.signal
    }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true })
  }
  return controller.signal
}

async function fetchApi(url: string, signal?: AbortSignal): Promise<JamendoResponse> {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT)
  const combined = signal ? combineSignals(signal, timeout) : timeout
  const res = await fetch(url, { signal: combined, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`API returned ${res.status}: ${res.statusText}`)
  const data: JamendoResponse = await res.json()
  if (data.headers?.status && data.headers.status !== 'success') {
    const msg = data.headers.error_message || `API error (code ${data.headers.code})`
    if (msg.toLowerCase().includes('internal error')) {
      throw new Error('Género no disponible en Jamendo. Elige otro de la lista.')
    }
    throw new Error(`Jamendo API: ${msg}`)
  }
  return data
}

async function transformTrack(track: JamendoTrack, genreId: string): Promise<Release> {
  const albumUrl = `https://www.jamendo.com/list/a${track.album_id}`
  const id = await sha1(albumUrl)
  const downloads: Download[] = []
  if (track.audiodownload) {
    downloads.push({ host: 'Jamendo', url: track.audiodownload })
  }
  return {
    id,
    source: 'jamendo',
    title: track.album_name,
    artists: [track.artist_name],
    album: track.album_name,
    label: '',
    catalog: '',
    year: Number(track.releasedate.slice(0, 4)) || 0,
    genre: genreId,
    subgenres: [],
    urlRelease: albumUrl,
    coverUrl: track.album_image || null,
    scrapeDate: new Date().toISOString(),
    scrapeJobIds: [],
    downloads,
  }
}

const MUSIC_GENRES: Genre[] = [
  { id: 'rock', label: 'Rock', path: '/en/album/rock' },
  { id: 'pop', label: 'Pop', path: '/en/album/pop' },
  { id: 'electronic', label: 'Electronic', path: '/en/album/electronic' },
  { id: 'hiphop', label: 'Hip-Hop', path: '/en/album/hiphop' },
  { id: 'jazz', label: 'Jazz', path: '/en/album/jazz' },
  { id: 'indie', label: 'Indie', path: '/en/album/indie' },
  { id: 'filmscore', label: 'Film Score', path: '/en/album/filmscore' },
  { id: 'classical', label: 'Classical', path: '/en/album/classical' },
  { id: 'chillout', label: 'Chillout', path: '/en/album/chillout' },
  { id: 'ambient', label: 'Ambient', path: '/en/album/ambient' },
  { id: 'folk', label: 'Folk', path: '/en/album/folk' },
  { id: 'metal', label: 'Metal', path: '/en/album/metal' },
  { id: 'latin', label: 'Latin', path: '/en/album/latin' },
  { id: 'rnb', label: 'RnB', path: '/en/album/rnb' },
  { id: 'reggae', label: 'Reggae', path: '/en/album/reggae' },
  { id: 'punk', label: 'Punk', path: '/en/album/punk' },
  { id: 'country', label: 'Country', path: '/en/album/country' },
  { id: 'house', label: 'House', path: '/en/album/house' },
  { id: 'blues', label: 'Blues', path: '/en/album/blues' },
  { id: 'techno', label: 'Techno', path: '/en/album/techno' },
  { id: 'trance', label: 'Trance', path: '/en/album/trance' },
  { id: 'dnb', label: 'Drum & Bass', path: '/en/album/dnb' },
]

export default class JamendoAdapter implements ScraperAdapter {
  id = 'jamendo'
  name = 'Jamendo'
  description = 'Creative Commons music from Jamendo'
  kind = 'api' as const

  getGenres(): Genre[] {
    return MUSIC_GENRES
  }

  getBaseUrl(): string {
    return BASE
  }

  getCachedMaxPage(genreId: string): { maxPage: number; detectedAt: string } | null {
    return loadPageLimitCache()[genreId] ?? null
  }

  clearCache(): void {
    localStorage.removeItem(PAGE_LIMIT_CACHE_KEY)
  }

  getSearchLinks() {
    return MUSIC_LINKS
  }

  async detectMaxPages(
    genreId: string,
    _options: { proxyUrl: string },
    signal?: AbortSignal,
  ): Promise<number> {
    const cached = loadPageLimitCache()
    if (cached[genreId]) return cached[genreId].maxPage

    const clientId = requireKey()
    const url = apiUrlCount(genreId, clientId)
    const data = await fetchApi(url, signal)
    const total = data.headers?.results_fullcount ?? 0
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

    savePageLimitCache({
      ...loadPageLimitCache(),
      [genreId]: { maxPage, detectedAt: new Date().toISOString() },
    })
    return maxPage
  }

  async scrape(
    options: ScrapeAdapterOptions,
    callbacks: ScrapeAdapterCallbacks,
    signal: AbortSignal,
    isPaused: () => boolean,
  ): Promise<void> {
    const { genreId, startPage, endPage, delayPage, delayRelease } = options
    const results: Release[] = []

    let clientId: string
    try {
      clientId = requireKey()
    } catch (err) {
      callbacks.onError((err as Error).message)
      callbacks.onComplete([])
      return
    }

    const progress: ScrapeProgress = {
      pagesTotal: endPage - startPage + 1,
      pagesDone: 0,
      releasesFound: 0,
      releasesScraped: 0,
      releasesSkipped: 0,
      currentPage: 0,
      currentRelease: '',
      errors: 0,
    }

    for (let page = startPage; page <= endPage; page++) {
      if (signal.aborted) return
      await checkPaused(isPaused)

      progress.currentPage = page
      callbacks.onProgress({ ...progress })

      try {
        const url = apiUrl(genreId, page, clientId)
        const data = await fetchApi(url, signal)
        const tracks = data.results ?? []

        progress.releasesFound += tracks.length
        callbacks.onProgress({ ...progress })

        for (const track of tracks) {
          if (signal.aborted) return
          await checkPaused(isPaused)

          progress.currentRelease = track.album_name
          callbacks.onProgress({ ...progress })

          try {
            const transformed = await transformTrack(track, genreId)
            results.push(transformed)
            progress.releasesScraped++
            callbacks.onReleaseDone(transformed)
          } catch (err) {
            progress.errors++
            callbacks.onError(`Error processing track: ${track.album_name} — ${(err as Error).message}`)
          }

          await delay(delayRelease)
        }

        progress.pagesDone++
        callbacks.onPageDone(page, tracks.length)
      } catch (err) {
        progress.errors++
        callbacks.onError(`Error scraping page ${page}: ${(err as Error).message}`)
      }

      await delay(delayPage)
    }

    callbacks.onComplete(results)
  }
}
