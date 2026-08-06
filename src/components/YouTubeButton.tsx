import { useState, useCallback, useEffect } from 'react'
import type { Release } from '../types/release'
import { searchYouTube } from '../services/youtube'
import { YouTubeEmbed } from './YouTubeEmbed'
import { useUserStateStore } from '../stores/user-state'
import { useYouTubeStore } from '../stores/youtube'
import { Music, Loader2, X } from 'lucide-react'

interface YouTubeButtonProps {
  release: Release
}

function generateQueries(release: Release): string[] {
  const artist = release.artists.join(' ')
  const title = release.title
  const stripped = title.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()

  const set = new Set<string>()
  set.add(`${artist} ${title}`.trim())
  if (stripped !== title) set.add(`${artist} ${stripped}`.trim())
  set.add(title)
  if (stripped !== title) set.add(stripped)
  return [...set]
}

export function YouTubeButton({ release }: YouTubeButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [videoId, setVideoId] = useState<string | null>(null)
  const { setListenStatus, logAction } = useUserStateStore()
  const activeReleaseId = useYouTubeStore((s) => s.activeReleaseId)
  const setActive = useYouTubeStore((s) => s.setActive)
  const clearActive = useYouTubeStore((s) => s.clearActive)

  useEffect(() => {
    if (state === 'loaded' && activeReleaseId !== null && activeReleaseId !== release.id) {
      setState('idle')
      setVideoId(null)
    }
  }, [activeReleaseId, release.id, state])

  useEffect(() => {
    return () => {
      if (state === 'loaded') {
        useYouTubeStore.getState().clearActive()
      }
    }
  }, [state])

  const handleClick = useCallback(async () => {
    if (state === 'loaded' && videoId) {
      clearActive()
      setState('idle')
      return
    }
    if (state === 'loading') return

    clearActive()
    setState('loading')
    const queries = generateQueries(release)
    let id: string | null = null
    for (const q of queries) {
      id = await searchYouTube(q)
      if (id) break
    }
    if (id) {
      setVideoId(id)
      setState('loaded')
      setActive(release.id, id)
      setListenStatus(release.id, 'listened')
      logAction(release.id, 'listened')
    } else {
      setState('error')
    }
  }, [release, state, videoId, setListenStatus, logAction, clearActive, setActive])

  return (
    <div>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-btn-red-bg text-btn-red-text rounded hover:bg-btn-red-hover cursor-pointer transition-colors"
        title="Search and play on YouTube"
      >
        {state === 'loading' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : state === 'loaded' ? (
          <X className="w-3 h-3" />
        ) : (
          <Music className="w-3 h-3" />
        )}
        {state === 'loading' ? 'Searching…' : state === 'loaded' ? 'Close' : state === 'error' ? 'Retry' : 'Listen'}
      </button>

      {state === 'loaded' && videoId && (
        <div className="relative">
          <YouTubeEmbed videoId={videoId} />
        </div>
      )}

      {state === 'error' && (
        <p className="text-xs text-red-400 mt-1">No video found</p>
      )}
    </div>
  )
}
