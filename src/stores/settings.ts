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
  proxyUrl: import.meta.env.VITE_DEFAULT_PROXY || 'https://corsproxy.io/?',
  activeAdapterId: '',
  apiKeys: {},
}

function envApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {}
  const env = import.meta.env as Record<string, unknown>

  const json = env.VITE_DEFAULT_API_KEYS
  if (typeof json === 'string' && json) {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>
      for (const [field, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && value) keys[field] = value
      }
    } catch {
      // noop
    }
  }

  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith('VITE_API_KEY_') && typeof value === 'string' && value) {
      keys[name.replace('VITE_API_KEY_', '').toLowerCase()] = value
    }
  }

  return keys
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
      const seeded = { ...DEFAULT, apiKeys: envApiKeys() }
      setProxyUrl(seeded.proxyUrl)
      set({ settings: seeded, loaded: true })
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
