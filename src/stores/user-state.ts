import { create } from 'zustand'
import type { UserReleaseState, HistoryEntry, ListenStatus, BuyStatus } from '../types/user-state'
import { getReleaseState, getAllStates, setReleaseState, addHistory, getHistory } from '../storage/db'

interface UserStateStore {
  states: Record<string, UserReleaseState>
  history: HistoryEntry[]
  loaded: boolean

  loadAllStates: () => Promise<void>
  loadState: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  setFavorite: (id: string, favorite: boolean) => Promise<void>
  setListenStatus: (id: string, status: ListenStatus) => Promise<void>
  setBuyStatus: (id: string, status: BuyStatus) => Promise<void>
  setNotes: (id: string, notes: string) => Promise<void>
  toggleTag: (id: string, tag: string) => Promise<void>
  logAction: (releaseId: string, action: HistoryEntry['action'], detail?: string) => Promise<void>
  loadHistory: () => Promise<void>
  resetAll: () => void
}

export const useUserStateStore = create<UserStateStore>((set, get) => ({
  states: {},
  history: [],
  loaded: false,

  loadAllStates: async () => {
    const all = await getAllStates()
    const map: Record<string, UserReleaseState> = {}
    for (const s of all) map[s.id] = s
    set({ states: map })
  },

  loadState: async (id: string) => {
    const state = await getReleaseState(id)
    if (state) {
      set((s) => ({ states: { ...s.states, [id]: state } }))
    }
  },

  toggleFavorite: async (id: string) => {
    const existing = get().states[id]
    const favorite = !existing?.favorite
    await setReleaseState(id, { favorite })
    set((s) => ({ states: { ...s.states, [id]: { ...s.states[id] || {} as UserReleaseState, id, favorite } } }))
  },

  setFavorite: async (id: string, favorite: boolean) => {
    await setReleaseState(id, { favorite })
    set((s) => ({ states: { ...s.states, [id]: { ...s.states[id] || {} as UserReleaseState, id, favorite } } }))
  },

  setListenStatus: async (id: string, listenStatus: ListenStatus) => {
    await setReleaseState(id, { listenStatus })
    set((s) => ({ states: { ...s.states, [id]: { ...s.states[id] || {} as UserReleaseState, id, listenStatus } } }))
  },

  setBuyStatus: async (id: string, buyStatus: BuyStatus) => {
    await setReleaseState(id, { buyStatus })
    set((s) => ({ states: { ...s.states, [id]: { ...s.states[id] || {} as UserReleaseState, id, buyStatus } } }))
  },

  setNotes: async (id: string, notes: string) => {
    await setReleaseState(id, { notes })
    set((s) => ({ states: { ...s.states, [id]: { ...s.states[id] || {} as UserReleaseState, id, notes } } }))
  },

  toggleTag: async (id: string, tag: string) => {
    const existing = get().states[id]
    const tags = existing?.tags ?? []
    const newTags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]
    await setReleaseState(id, { tags: newTags })
    set((s) => ({ states: { ...s.states, [id]: { ...s.states[id] || {} as UserReleaseState, id, tags: newTags } } }))
  },

  logAction: async (releaseId: string, action: HistoryEntry['action'], detail?: string) => {
    const entry: HistoryEntry = { releaseId, timestamp: new Date().toISOString(), action, detail }
    await addHistory(entry)
    set((s) => ({ history: [entry, ...s.history] }))
  },

  loadHistory: async () => {
    const history = await getHistory()
    set({ history, loaded: true })
  },

  resetAll: () => {
    set({ states: {}, history: [], loaded: false })
  },
}))
