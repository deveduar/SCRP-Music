import type { Release } from './release'
import type { UserReleaseState, HistoryEntry, UserSettings } from './user-state'
import type { ScrapeJob } from './scraper'

export interface ExportPayload {
  version: 1
  exportedAt: string
  releases: Release[]
  states: UserReleaseState[]
  history: HistoryEntry[]
  jobs: ScrapeJob[]
  settings: UserSettings | null
}
