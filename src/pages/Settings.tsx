import { useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useSettingsStore } from '../stores/settings'
import { useReleasesStore } from '../stores/releases'
import { useUserStateStore } from '../stores/user-state'
import { useScraperStore } from '../stores/scraper'
import db, { exportAll, importAll } from '../storage/db'

export function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [addingNew, setAddingNew] = useState(false)
  const [newAdapterName, setNewAdapterName] = useState('')
  const [newAdapterKey, setNewAdapterKey] = useState('')

  const handleAddKey = () => {
    const name = newAdapterName.trim()
    if (name && newAdapterKey.trim()) {
      update({ apiKeys: { ...settings.apiKeys, [name]: newAdapterKey.trim() } })
      setNewAdapterName('')
      setNewAdapterKey('')
      setAddingNew(false)
    }
  }

  const handleExport = async () => {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `scrp-music-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (data.version !== 1) {
        alert('Invalid export file: version mismatch.')
        return
      }
      const summary = `Import ${data.releases?.length ?? 0} releases, ${data.states?.length ?? 0} states, ${data.history?.length ?? 0} history entries, ${data.jobs?.length ?? 0} jobs? This will replace all current data.`
      if (!window.confirm(summary)) return
      await importAll(data)
      useReleasesStore.getState().initFromDb()
      useUserStateStore.getState().loadAllStates()
      useUserStateStore.getState().loadHistory()
      useScraperStore.getState().loadJobs()
    } catch (err) {
      alert('Import failed: ' + (err as Error).message)
    }
    e.target.value = ''
  }

  const handleResetAll = async () => {
    if (window.confirm('This will delete ALL data: releases, favorites, history, and scrape jobs. This cannot be undone. Continue?')) {
      await useScraperStore.getState().resetAll()
    }
  }

  const handleResetUserData = async () => {
    if (window.confirm('This will clear your favorites, listen status, and history. Releases and scrape jobs will be kept. Continue?')) {
      await db.states.clear()
      await db.history.clear()
      useUserStateStore.getState().resetAll()
    }
  }

  const handleResetScrapeData = async () => {
    if (window.confirm('This will delete all scraped releases and jobs. Your favorites, listen status, and history will be kept. Continue?')) {
      await db.releases.clear()
      await db.jobs.clear()
      useReleasesStore.getState().clearAll()
      await useScraperStore.getState().loadJobs()
    }
  }

  return (
    <div className="p-6 overflow-auto h-full max-w-xl">
      <h2 className="text-xl font-bold text-content mb-6">Settings</h2>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-content">Dark Mode</p>
            <p className="text-xs text-content-muted">Toggle between dark and light theme</p>
          </div>
          <button
            onClick={() => update({ darkMode: !settings.darkMode })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.darkMode ? 'bg-accent' : 'bg-surface-tertiary'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.darkMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div>
          <label className="text-sm font-medium text-content">Items per page</label>
          <p className="text-xs text-content-muted mb-2">Number of releases visible in the list</p>
          <select
            value={settings.itemsPerPage}
            onChange={(e) => update({ itemsPerPage: Number(e.target.value) })}
            className="w-full px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-content">CORS Proxy URL</label>
          <p className="text-xs text-content-muted mb-2">Proxy used to bypass CORS when scraping</p>
          <input
            type="text"
            value={settings.proxyUrl}
            onChange={(e) => update({ proxyUrl: e.target.value })}
            className="w-full px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content font-mono"
          />
        </div>

        <hr className="border-border-main" />

        <div>
          <h3 className="text-sm font-semibold text-content mb-3">API Keys</h3>
          <p className="text-xs text-content-muted mb-2">API keys required by some adapters (e.g. for Jamendo)</p>
          <div className="space-y-2">
            {Object.entries(settings.apiKeys).map(([adapter, key]) => (
                <div key={adapter} className="flex items-center gap-2">
                  <span className="text-xs text-content-muted font-mono min-w-20">{adapter}</span>
                  <div className="relative flex-1">
                    <input
                      type={showKeys[adapter] ? 'text' : 'password'}
                      value={key}
                      onChange={(e) => update({ apiKeys: { ...settings.apiKeys, [adapter]: e.target.value } })}
                      className="w-full px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content font-mono pr-8"
                    />
                    <button
                      onClick={() => setShowKeys((prev) => ({ ...prev, [adapter]: !prev[adapter] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-content-muted hover:text-content transition-colors"
                      tabIndex={-1}
                    >
                      {showKeys[adapter] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      const next = { ...settings.apiKeys }
                      delete next[adapter]
                      update({ apiKeys: next })
                    }}
                    className="p-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                    title="Remove key"
                  >
                    ×
                  </button>
                </div>
              ))}
            {addingNew ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newAdapterName}
                  onChange={(e) => setNewAdapterName(e.target.value)}
                  placeholder="e.g. jamendo"
                  className="min-w-20 px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content font-mono"
                />
                <input
                  type="text"
                  value={newAdapterKey}
                  onChange={(e) => setNewAdapterKey(e.target.value)}
                  placeholder="API key"
                  className="flex-1 px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content font-mono"
                />
                <button
                  onClick={handleAddKey}
                  className="p-2 text-xs text-green-400 hover:text-green-300 transition-colors"
                  title="Save"
                >
                  ✓
                </button>
                <button
                  onClick={() => { setAddingNew(false); setNewAdapterName(''); setNewAdapterKey('') }}
                  className="p-2 text-xs text-content-muted hover:text-content transition-colors"
                  title="Cancel"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingNew(true)}
                className="text-xs text-accent hover:text-accent-hover transition-colors"
              >
                + Add API key
              </button>
            )}
          </div>
        </div>

        <hr className="border-border-main" />

        <div>
          <h3 className="text-sm font-semibold text-content mb-3">Data Management</h3>
          <div className="space-y-2">
            <button
              onClick={handleResetAll}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 bg-red-900/10 border border-red-900/40 rounded-lg hover:bg-red-900/20 transition-colors"
            >
              <span className="font-medium">Reset All Data</span>
              <span className="text-xs text-content-muted ml-auto">Clears everything including releases</span>
            </button>
            <button
              onClick={handleResetUserData}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-amber-400 bg-amber-900/10 border border-amber-900/40 rounded-lg hover:bg-amber-900/20 transition-colors"
            >
              <span className="font-medium">Reset User Data</span>
              <span className="text-xs text-content-muted ml-auto">Clears favorites, history — keeps releases &amp; jobs</span>
            </button>
            <button
              onClick={handleResetScrapeData}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-cyan-400 bg-cyan-900/10 border border-cyan-900/40 rounded-lg hover:bg-cyan-900/20 transition-colors"
            >
              <span className="font-medium">Reset Scrape Data</span>
              <span className="text-xs text-content-muted ml-auto">Clears releases and jobs — keeps favorites &amp; history</span>
            </button>
          </div>
        </div>

        <hr className="border-border-main" />

        <div>
          <h3 className="text-sm font-semibold text-content mb-3">Export / Import</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <div className="space-y-2">
            <button
              onClick={handleExport}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-blue-400 bg-blue-900/10 border border-blue-900/40 rounded-lg hover:bg-blue-900/20 transition-colors"
            >
              <span className="font-medium">Export All Data</span>
              <span className="text-xs text-content-muted ml-auto">Download all data as JSON</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-green-400 bg-green-900/10 border border-green-900/40 rounded-lg hover:bg-green-900/20 transition-colors"
            >
              <span className="font-medium">Import All Data</span>
              <span className="text-xs text-content-muted ml-auto">Replace current data from JSON file</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
