import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeProvider'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Browse } from './pages/Browse'
import { Scraper } from './pages/Scraper'
import { History } from './pages/History'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import { useReleasesStore } from './stores/releases'
import { useUserStateStore } from './stores/user-state'
import { useScraperStore } from './stores/scraper'
import { useSettingsStore } from './stores/settings'
import { setProxyUrl, checkRelayHealth } from './services/cors-proxy'

const adapterModules = import.meta.glob('../local_adapters/*-adapter.ts')

async function loadAllAdapters(): Promise<void> {
  const entries = Object.entries(adapterModules)
  if (entries.length === 0) return

  for (const [_path, importFn] of entries) {
    try {
      const mod = await importFn()
      const AdapterClass = (mod as Record<string, unknown>).default as
        | (new () => { id: string })
        | undefined
      if (AdapterClass && typeof AdapterClass === 'function') {
        const instance = new AdapterClass()
        if (instance?.id && typeof (instance as Record<string, unknown>).getGenres === 'function') {
          useScraperStore.getState().registerAdapter(instance as never)
        }
      }
    } catch (e) {
      console.warn('Failed to load adapter:', _path, e)
    }
  }
}

function DataInit({ children }: { children: React.ReactNode }) {
  const initialized = useReleasesStore((s) => s.initialized)
  const initFromDb = useReleasesStore((s) => s.initFromDb)
  const loadAllStates = useUserStateStore((s) => s.loadAllStates)
  const loadJobs = useScraperStore((s) => s.loadJobs)
  const registerAdapter = useScraperStore((s) => s.registerAdapter)
  const loadSettings = useSettingsStore((s) => s.load)
  const [started, setStarted] = useState(false)
  const [adaptersLoaded, setAdaptersLoaded] = useState(false)

  useEffect(() => {
    if (started) return
    setStarted(true)

    loadSettings().then(() => {
      setProxyUrl(useSettingsStore.getState().settings.proxyUrl)
    })

    checkRelayHealth()

    loadAllAdapters().then(() => {
      const savedId = useSettingsStore.getState().settings.activeAdapterId
      const store = useScraperStore.getState()
      if (savedId && store.adapters[savedId]) {
        store.setActiveAdapter(savedId)
      } else {
        const ids = Object.keys(store.adapters)
        if (ids.length > 0) {
          store.setActiveAdapter(ids[0])
        }
      }
      setAdaptersLoaded(true)
    })

    initFromDb()
    loadAllStates()
    loadJobs()
  }, [started, initFromDb, loadAllStates, loadJobs, registerAdapter, loadSettings])

  if (!initialized || !adaptersLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface text-content-muted text-sm">
        Loading...
      </div>
    )
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <DataInit>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/scraper" element={<Scraper />} />
              <Route path="/history" element={<History />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </DataInit>
      </ThemeProvider>
    </BrowserRouter>
  )
}
