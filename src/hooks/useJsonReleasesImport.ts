import { useCallback, useRef } from 'react'
import { useReleasesStore } from '../stores/releases'
import type { Release } from '../types/release'

export function useJsonReleasesImport() {
  const inputRef = useRef<HTMLInputElement>(null)
  const loadReleases = useReleasesStore((s) => s.loadReleases)

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data: Release[] = JSON.parse(text)
      await loadReleases(data)
    } catch (err) {
      console.error('Failed to load JSON:', err)
    }
  }, [loadReleases])

  const openPicker = useCallback(() => {
    inputRef.current?.click()
  }, [])

  return { inputRef, handleFile, openPicker }
}
