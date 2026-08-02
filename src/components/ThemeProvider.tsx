import { useEffect, type ReactNode } from 'react'
import { useSettingsStore } from '../stores/settings'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const darkMode = useSettingsStore((s) => s.settings.darkMode)
  const loaded = useSettingsStore((s) => s.loaded)
  const load = useSettingsStore((s) => s.load)

  useEffect(() => {
    if (!loaded) load()
  }, [loaded, load])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', darkMode ? '#09090b' : '#ffffff')
  }, [darkMode])

  return <>{children}</>
}
