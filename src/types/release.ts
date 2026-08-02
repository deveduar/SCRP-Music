export interface ScrapedRelease {
  titulo: string
  url_release: string
  cover_url?: string | null
  descargas: ScrapedDownload[]
}

export interface ScrapedDownload {
  host: string
  url: string
}

export interface Release {
  id: string
  stableIdentity?: string
  source: string
  title: string
  artists: string[]
  album: string
  label: string
  catalog: string
  year: number
  genre: string
  subgenres: string[]
  urlRelease: string
  coverUrl: string | null
  scrapeDate: string
  scrapeJobIds: string[]
  downloads: Download[]
}

export interface Download {
  host: string
  url: string
}
