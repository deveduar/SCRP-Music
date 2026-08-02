export type ListenStatus = 'unlistened' | 'listened' | 'pending' | 'skipped'
export type BuyStatus = 'none' | 'bought' | 'wishlist'

export interface UserReleaseState {
  id: string
  favorite: boolean
  listenStatus: ListenStatus
  buyStatus: BuyStatus
  notes: string
  tags: string[]
  lastOpened: string | null
  openCount: number
}

export interface HistoryEntry {
  id?: number
  releaseId: string
  timestamp: string
  action: 'opened' | 'link_clicked' | 'favorited' | 'unfavorited' | 'listened' | 'unlistened' | 'scrape_completed' | 'page_detected' | 'batch_action'
  detail?: string
}

export interface UserSettings {
  id: string
  darkMode: boolean
  itemsPerPage: number
  defaultSort: string
  quickLinks: string[]
  proxyUrl: string
  activeAdapterId: string
  apiKeys: Record<string, string>
}
