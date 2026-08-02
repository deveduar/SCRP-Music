import { create } from 'zustand'
import type { UserSettings } from '../types/user-state'
import { getSettings, saveSettings } from '../storage/db'
import { setProxyUrl } from '../services/cors-proxy'

interface SettingsStore {
  settings: UserSettings
  loaded: boolean
  load: () => Promise<void>
  update: (partial: Partial<UserSettings>) => Promise<void>
}

const DEFAULT: UserSettings = {
  id: '',
  darkMode: true,
  itemsPerPage: 50,
  defaultSort: 'year',
  quickLinks: ['google', 'youtube', 'spotify', 'beatport', 'discogs', 'bandcamp', 'soundcloud'],
  proxyUrl: 'https://corsproxy.io/?',
  activeAdapterId: '',
  apiKeys: {},
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT,
  loaded: false,

  load: async () => {
    const saved = await getSettings()
    if (saved) {
      const merged = { ...DEFAULT, ...saved }
      setProxyUrl(merged.proxyUrl)
      set({ settings: merged, loaded: true })
    } else {
      setProxyUrl(DEFAULT.proxyUrl)
      set({ loaded: true })
    }
  },

  update: async (partial: Partial<UserSettings>) => {
    const next = { ...get().settings, ...partial }
    await saveSettings(next)
    if (partial.proxyUrl !== undefined) {
      setProxyUrl(next.proxyUrl)
    }
    set({ settings: next })
  },
}))
