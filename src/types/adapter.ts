import type { Genre, ScrapeProgress } from './scraper'
import type { Release } from './release'
import type { QuickLink } from './links'

export type AdapterKind = 'html' | 'api'

export interface ScraperAdapter {
  id: string
  name: string
  description?: string
  kind: AdapterKind
  supportsFastSkipExisting?: boolean

  getGenres(): Genre[]
  getBaseUrl(): string
  getCachedMaxPage(genreId: string): { maxPage: number; detectedAt: string } | null
  clearCache(): void

  detectMaxPages(
    genreId: string,
    options: { proxyUrl: string },
    signal?: AbortSignal,
  ): Promise<number>

  getSearchLinks(): QuickLink[]

  scrape(
    options: ScrapeAdapterOptions,
    callbacks: ScrapeAdapterCallbacks,
    signal: AbortSignal,
    isPaused: () => boolean,
  ): Promise<void>
}

export interface ScrapeAdapterOptions {
  genreId: string
  startPage: number
  endPage: number
  delayPage: number
  delayRelease: number
  proxyUrl: string
  fastSkipExisting?: boolean
}

export interface ScrapeAdapterCallbacks {
  onProgress: (progress: ScrapeProgress) => void
  onPageDone: (page: number, count: number, skipped?: number) => void
  onReleaseDone: (release: Release) => void
  onReleaseSkipped?: (title: string) => void
  shouldSkipExistingRelease?: (candidate: {
    source: string
    title: string
    urlRelease: string
  }) => boolean
  onError: (msg: string) => void
  onComplete: (results: Release[]) => void
}
