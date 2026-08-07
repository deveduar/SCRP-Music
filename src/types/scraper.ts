export interface Genre {
  id: string
  label: string
  path: string
  query?: string
}

export interface ScrapeJob {
  id: string
  adapterId: string
  adapterName: string
  genre: Genre
  startPage: number
  endPage: number
  delayPage: number
  delayRelease: number
  status: 'completed' | 'cancelled' | 'error'
  totalReleases: number
  newReleases: number
  updatedReleases: number
  date: string
}

export interface ScrapeProgress {
  pagesTotal: number
  pagesDone: number
  releasesFound: number
  releasesScraped: number
  releasesSkipped: number
  currentPage: number
  currentRelease: string
  errors: number
}

export interface ScrapedPageResult {
  page: number
  releases: { titulo: string; urlRelease: string }[]
}

export interface ScraperConfig {
  proxyUrl: string
  maxConcurrentReleases: number
  autoLoadResults: boolean
}
