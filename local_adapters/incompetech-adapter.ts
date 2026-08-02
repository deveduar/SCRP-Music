import type { Genre, ScrapeProgress } from '../src/types/scraper'
import type { Release, Download } from '../src/types/release'
import type { ScraperAdapter, ScrapeAdapterOptions, ScrapeAdapterCallbacks } from '../src/types/adapter'
import { MUSIC_LINKS } from './shared'
import { fetchWithProxy } from '../src/services/cors-proxy'

const BASE = 'https://incompetech.com'
const MUSIC_PAGE_URL = `${BASE}/music/royalty-free/music.html`
const PIECES_URL = `${BASE}/music/royalty-free/pieces.json`
const PAGE_LIMIT_CACHE_KEY = 'incompetech_page_limits'
const PAGE_SIZE = 20

interface PageLimitEntry {
  maxPage: number
  detectedAt: string
}

interface IncompetechPiece {
  uuid?: string
  title: string
  filename: string
  length?: string
  instruments?: string
  genre?: string
  bpm?: string
  description?: string
  feel?: string
  uploaded?: string
  isrc?: string
  collection?: string
  sheetmusic?: string | null
  video?: string | null
  itunes?: string
  wav?: string | null
  filmmusicURL?: string | null
}

interface ParsedGenreEntry {
  id: string
  label: string
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

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function parseGenreEntries(html: string): ParsedGenreEntry[] {
  const match = html.match(/const genres = \[(.*?)\];/s)
  if (!match) return []
  const body = match[1]
  const entries: ParsedGenreEntry[] = []
  const regex = /"id"\s*:\s*(\d+)\s*,\s*"genre"\s*:\s*"([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(body)) !== null) {
    const [, rawId, label] = m
    entries.push({ id: rawId, label })
  }
  return entries
}

function buildGenreList(entries: ParsedGenreEntry[]): Genre[] {
  return [
    { id: 'all', label: 'All genres', path: '/music/royalty-free/music.html' },
    ...entries.map((entry) => ({
      id: slugify(entry.label),
      label: entry.label,
      path: `/music/royalty-free/music.html?genre=${slugify(entry.label)}`,
    })),
  ]
}

function buildFallbackGenres(): Genre[] {
  return [
    { id: 'all', label: 'All genres', path: '/music/royalty-free/music.html' },
    { id: 'african', label: 'African', path: '/music/royalty-free/music.html?genre=african' },
    { id: 'blues', label: 'Blues', path: '/music/royalty-free/music.html?genre=blues' },
    { id: 'classical', label: 'Classical', path: '/music/royalty-free/music.html?genre=classical' },
    { id: 'contemporary', label: 'Contemporary', path: '/music/royalty-free/music.html?genre=contemporary' },
    { id: 'disco', label: 'Disco', path: '/music/royalty-free/music.html?genre=disco' },
    { id: 'electronica', label: 'Electronica', path: '/music/royalty-free/music.html?genre=electronica' },
    { id: 'funk', label: 'Funk', path: '/music/royalty-free/music.html?genre=funk' },
    { id: 'holiday', label: 'Holiday', path: '/music/royalty-free/music.html?genre=holiday' },
    { id: 'horror', label: 'Horror', path: '/music/royalty-free/music.html?genre=horror' },
    { id: 'jazz', label: 'Jazz', path: '/music/royalty-free/music.html?genre=jazz' },
    { id: 'latin', label: 'Latin', path: '/music/royalty-free/music.html?genre=latin' },
    { id: 'modern', label: 'Modern', path: '/music/royalty-free/music.html?genre=modern' },
    { id: 'musical', label: 'Musical', path: '/music/royalty-free/music.html?genre=musical' },
    { id: 'polka', label: 'Polka', path: '/music/royalty-free/music.html?genre=polka' },
    { id: 'pop', label: 'Pop', path: '/music/royalty-free/music.html?genre=pop' },
    { id: 'reggae', label: 'Reggae', path: '/music/royalty-free/music.html?genre=reggae' },
    { id: 'rock', label: 'Rock', path: '/music/royalty-free/music.html?genre=rock' },
    { id: 'silent-film-score', label: 'Silent Film Score', path: '/music/royalty-free/music.html?genre=silent-film-score' },
    { id: 'ska', label: 'Ska', path: '/music/royalty-free/music.html?genre=ska' },
    { id: 'soundtrack', label: 'Soundtrack', path: '/music/royalty-free/music.html?genre=soundtrack' },
    { id: 'stings', label: 'Stings', path: '/music/royalty-free/music.html?genre=stings' },
    { id: 'unclassifiable', label: 'Unclassifiable', path: '/music/royalty-free/music.html?genre=unclassifiable' },
    { id: 'world', label: 'World', path: '/music/royalty-free/music.html?genre=world' },
    { id: 'urban', label: 'Urban', path: '/music/royalty-free/music.html?genre=urban' },
  ]
}

export default class IncompetechAdapter implements ScraperAdapter {
  id = 'incompetech'
  name = 'Incompetech'
  description = 'Royalty-free music by Kevin MacLeod'
  kind = 'html' as const

  private genreCache: Genre[] = []
  private genreLookup = new Map<string, string>()

  getGenres(): Genre[] {
    if (this.genreCache.length > 0) return this.genreCache
    void this.loadGenres()
    return buildFallbackGenres()
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
    _signal?: AbortSignal,
  ): Promise<number> {
    const cached = loadPageLimitCache()
    if (cached[genreId]) return cached[genreId].maxPage

    try {
      const genres = this.genreCache.length > 0 ? this.genreCache : await this.loadGenres()
      const selectedGenre = genreId && genreId !== 'all'
        ? genres.find((g) => g.id === genreId) ?? null
        : null

      const rawPayload = await fetchWithProxy(PIECES_URL, _signal)
      const pieces: IncompetechPiece[] = JSON.parse(rawPayload)
      const filteredPieces = this.filterPiecesByGenre(pieces, selectedGenre, genres)
      const maxPage = Math.max(1, Math.ceil(filteredPieces.length / PAGE_SIZE))

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
    try {
      const genres = this.genreCache.length > 0 ? this.genreCache : await this.loadGenres()
      const selectedGenre = options.genreId && options.genreId !== 'all'
        ? genres.find((g) => g.id === options.genreId) ?? null
        : null

      const rawPayload = await fetchWithProxy(PIECES_URL, signal)
      const pieces: IncompetechPiece[] = JSON.parse(rawPayload)
      const filteredByGenre = this.filterPiecesByGenre(pieces, selectedGenre, genres)
      const filteredPieces = this.filterPiecesByPage(filteredByGenre, options)
      const results: Release[] = []
      const progress: ScrapeProgress = {
        pagesTotal: Math.max(1, Math.ceil(filteredByGenre.length / PAGE_SIZE)),
        pagesDone: 0,
        releasesFound: 0,
        releasesScraped: 0,
        releasesSkipped: 0,
        currentPage: Math.max(1, options.startPage || 1),
        currentRelease: '',
        errors: 0,
      }

      for (const piece of filteredPieces) {
        if (signal.aborted) throw new Error('Scrape cancelled')
        await checkPaused(isPaused)

        const release = await this.transformPiece(piece, genres)
        progress.releasesFound += 1
        progress.releasesScraped += 1
        progress.currentRelease = release.title
        callbacks.onProgress({ ...progress })
        callbacks.onReleaseDone(release)
        results.push(release)

        if (options.delayRelease > 0) {
          await delay(options.delayRelease)
        }
      }

      progress.pagesDone = 1
      callbacks.onProgress({ ...progress })
      callbacks.onPageDone(1, results.length)
      callbacks.onComplete(results)
    } catch (err) {
      callbacks.onError((err as Error).message)
      callbacks.onComplete([])
    }
  }

  private filterPiecesByGenre(
    pieces: IncompetechPiece[],
    selectedGenre: Genre | null,
    genres: Genre[],
  ): IncompetechPiece[] {
    if (!selectedGenre) return pieces

    return pieces.filter((piece) => {
      const genreLabel = this.resolveGenreLabel(piece.genre, genres)
      return slugify(genreLabel) === selectedGenre.id
    })
  }

  private filterPiecesByPage(pieces: IncompetechPiece[], options: ScrapeAdapterOptions): IncompetechPiece[] {
    const startPage = Math.max(1, options.startPage || 1)
    const endPage = Math.max(startPage, options.endPage || startPage)
    const startIndex = (startPage - 1) * PAGE_SIZE
    const endIndex = endPage * PAGE_SIZE

    return pieces.slice(startIndex, endIndex)
  }

  private async loadGenres(): Promise<Genre[]> {
    if (this.genreCache.length > 0) return this.genreCache

    try {
      const html = await fetchWithProxy(MUSIC_PAGE_URL)
      const entries = parseGenreEntries(html)
      if (entries.length > 0) {
        const genres = buildGenreList(entries)
        this.genreCache = genres
        this.genreLookup = new Map(entries.map((entry) => [entry.id, entry.label]))
        return genres
      }
    } catch {
      // fall back silently to the built-in list below
    }

    const fallback = buildFallbackGenres()
    this.genreCache = fallback
    this.genreLookup = new Map(fallback.map((genre) => [genre.id, genre.label]))
    return fallback
  }

  private async transformPiece(piece: IncompetechPiece, genres: Genre[]): Promise<Release> {
    const identityBase = piece.uuid || `${piece.title}-${piece.filename}`
    const id = await sha1(identityBase)
    const label = this.resolveGenreLabel(piece.genre, genres)
    const downloads: Download[] = []
    if (piece.filename) {
      const downloadUrl = `${BASE}/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(piece.filename)}`
      downloads.push({ host: 'Incompetech', url: downloadUrl })
    }

    const subgenres = [piece.feel, piece.instruments]
      .filter(Boolean)
      .flatMap((value) => String(value).split(/[,/;]+/).map((s) => s.trim()).filter(Boolean))

    return {
      id,
      source: this.id,
      title: piece.title.trim(),
      artists: ['Kevin MacLeod'],
      album: 'Royalty-Free Music',
      label: 'Incompetech',
      catalog: piece.isrc || '',
      year: piece.uploaded ? Number(piece.uploaded.slice(0, 4)) || 0 : 0,
      genre: label,
      subgenres,
      urlRelease: `${BASE}/music/royalty-free/music.html`,
      coverUrl: null,
      scrapeDate: new Date().toISOString(),
      scrapeJobIds: [],
      downloads,
    }
  }

  private resolveGenreLabel(rawGenre: string | undefined, genres: Genre[]): string {
    const lookupKey = (rawGenre || '').trim()
    if (!lookupKey) return 'Unclassifiable'

    if (this.genreLookup.has(lookupKey)) {
      return this.genreLookup.get(lookupKey) || 'Unclassifiable'
    }

    const bySlug = genres.find((genre) => slugify(genre.label) === slugify(lookupKey))
    if (bySlug) return bySlug.label

    return lookupKey
  }
}
