import { create } from 'zustand'

interface YouTubeStore {
  activeReleaseId: string | null
  activeVideoId: string | null
  setActive: (releaseId: string, videoId: string) => void
  clearActive: () => void
}

export const useYouTubeStore = create<YouTubeStore>((set) => ({
  activeReleaseId: null,
  activeVideoId: null,

  setActive: (releaseId, videoId) => set({ activeReleaseId: releaseId, activeVideoId: videoId }),

  clearActive: () => set({ activeReleaseId: null, activeVideoId: null }),
}))
