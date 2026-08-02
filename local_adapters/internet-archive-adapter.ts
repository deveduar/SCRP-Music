import type { Genre, ScrapeProgress } from '../src/types/scraper'
import type { Release } from '../src/types/release'
import type { ScraperAdapter, ScrapeAdapterOptions, ScrapeAdapterCallbacks } from '../src/types/adapter'
import { MUSIC_LINKS } from './shared'
import { fetchWithProxy } from '../src/services/cors-proxy'

const BASE = 'https://archive.org'
const SEARCH_BASE = `${BASE}/advancedsearch.php`
const PAGE_LIMIT_CACHE_KEY = 'internetarchive_page_limits'
const PAGE_SIZE = 50

interface PageLimitEntry {
  maxPage: number
  detectedAt: string
}

interface ArchiveDoc {
  identifier: string
  title?: string
  creator?: string | string[]
  year?: string | number
  subject?: string[]
  publisher?: string
}

interface ArchiveSearchResponse {
  response: {
    numFound: number
    start: number
    docs: ArchiveDoc[]
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function checkPaused(isPaused: () => boolean): Promise<void> {
  while (isPaused()) {
    await delay(500)
  }
}

async function sha1(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const hash = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function loadPageLimitCache(): Record<string, PageLimitEntry> {
  try {
    const raw = JSON.parse(localStorage.getItem(PAGE_LIMIT_CACHE_KEY) || '{}')
    const result: Record<string, PageLimitEntry> = {}
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'number') {
        result[key] = { maxPage: value, detectedAt: new Date().toISOString() }
      } else {
        result[key] = value as PageLimitEntry
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

function buildGenreList(): Genre[] {
  return [
    { id: 'all', label: 'All genres', path: '/' },
    { id: 'rock', label: 'Rock', path: '/search?subject=rock' },
    { id: 'jazz', label: 'Jazz', path: '/search?subject=jazz' },
    { id: 'classical', label: 'Classical', path: '/search?subject=classical' },
    { id: 'folk', label: 'Folk', path: '/search?subject=folk' },
    { id: 'blues', label: 'Blues', path: '/search?subject=blues' },
    { id: 'country', label: 'Country', path: '/search?subject=country' },
    { id: 'electronic', label: 'Electronic', path: '/search?subject=electronic' },
    { id: 'ambient', label: 'Ambient', path: '/search?subject=ambient' },
    { id: 'world', label: 'World', path: '/search?subject=world' },
    { id: 'reggae', label: 'Reggae', path: '/search?subject=reggae' },
    { id: 'soul', label: 'Soul', path: '/search?subject=soul' },
    { id: 'funk', label: 'Funk', path: '/search?subject=funk' },
  ]
}

function buildQuery(genreId: string): string {
  const collectionQuery = '(collection:etree OR collection:audio_music)'
  const yearQuery = 'year:[1900 TO 2025]'
  const genreQuery = genreId && genreId !== 'all'
    ? `subject:"${genreId}"`
    : ''

  return [collectionQuery, 'mediatype:audio', yearQuery, genreQuery]
    .filter(Boolean)
    .join(' AND ')
}

function buildSearchUrl(genreId: string, page: number): string {
  const q = buildQuery(genreId)
  return `${SEARCH_BASE}?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&fl[]=subject&fl[]=publisher&rows=${PAGE_SIZE}&page=${page}&output=json`
}

function parseArtist(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function parseYear(value: string | number | undefined): number {
  if (!value) return 0
  const year = Number(value)
  return Number.isInteger(year) ? year : 0
}

function parseGenres(doc: ArchiveDoc, selectedGenre: string): string {
  if (selectedGenre && selectedGenre !== 'all') {
    return selectedGenre
  }

  const subjects = doc.subject ?? []
  if (subjects.length > 0) {
    return Array.isArray(subjects) ? String(subjects[0]) : String(subjects)
  }

  return 'Internet Archive'
}

export default class InternetArchiveAdapter implements ScraperAdapter {
  id = 'internetarchive'
  name = 'Internet Archive'
  description = 'Audio from Internet Archive with filtered search results'
  kind = 'api' as const

  getGenres(): Genre[] {
    return buildGenreList()
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

    try {
      const url = buildSearchUrl(genreId, 1)
      const response = await fetchWithProxy(url, signal)
      const data: ArchiveSearchResponse = JSON.parse(response)
      const total = data.response?.numFound ?? 0
      const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

      savePageLimitCache({
        ...cached,
        [genreId]: { maxPage, detectedAt: new Date().toISOString() },
      })
      return maxPage
    } catch {
      return 1
    }
  }

  async scrape(
    options: ScrapeAdapterOptions,
    callbacks: ScrapeAdapterCallbacks,
    signal: AbortSignal,
    isPaused: () => boolean,
  ): Promise<void> {
    const { genreId, startPage, endPage, delayPage, delayRelease } = options
    const results: Release[] = []

    const progress: ScrapeProgress = {
      pagesTotal: Math.max(1, endPage - startPage + 1),
      pagesDone: 0,
      releasesFound: 0,
      releasesScraped: 0,
      releasesSkipped: 0,
      currentPage: 0,
      currentRelease: '',
      errors: 0,
    }

    for (let page = Math.max(1, startPage); page <= Math.max(startPage, endPage); page++) {
      if (signal.aborted) return
      await checkPaused(isPaused)

      progress.currentPage = page
      callbacks.onProgress({ ...progress })

      try {
        const url = buildSearchUrl(genreId, page)
        const response = await fetchWithProxy(url, signal)
        const data: ArchiveSearchResponse = JSON.parse(response)
        const docs = data.response?.docs ?? []

        progress.releasesFound += docs.length
        callbacks.onProgress({ ...progress })

        for (const doc of docs) {
          if (signal.aborted) return
          await checkPaused(isPaused)

          progress.currentRelease = doc.title || doc.identifier
          callbacks.onProgress({ ...progress })

          try {
            const id = await sha1(doc.identifier)
            const title = doc.title?.trim() || doc.identifier
            const artists = parseArtist(doc.creator)
            const genre = parseGenres(doc, genreId)
            const year = parseYear(doc.year)
            const coverUrl = `${BASE}/services/img/${doc.identifier}`
            const urlRelease = `${BASE}/details/${doc.identifier}`
            const downloads = [
              { host: 'Internet Archive', url: `${BASE}/download/${doc.identifier}` },
            ]

            const release: Release = {
              id,
              source: this.id,
              title,
              artists,
              album: title,
              label: doc.publisher ?? '',
              catalog: doc.identifier,
              year,
              genre,
              subgenres: Array.isArray(doc.subject) ? doc.subject.map(String) : doc.subject ? [String(doc.subject)] : [],
              urlRelease,
              coverUrl,
              scrapeDate: new Date().toISOString(),
              scrapeJobIds: [],
              downloads,
            }

            results.push(release)
            progress.releasesScraped++
            callbacks.onReleaseDone(release)
          } catch (err) {
            progress.errors++
            callbacks.onError(`Error processing item ${doc.identifier}: ${(err as Error).message}`)
          }

          await delay(delayRelease)
        }

        progress.pagesDone++
        callbacks.onPageDone(page, docs.length)
      } catch (err) {
        progress.errors++
        callbacks.onError(`Error scraping page ${page}: ${(err as Error).message}`)
      }

      await delay(delayPage)
    }

    callbacks.onComplete(results)
  }
}
