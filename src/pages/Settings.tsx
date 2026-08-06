import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useSettingsStore } from '../stores/settings'
import { useReleasesStore } from '../stores/releases'
import { useUserStateStore } from '../stores/user-state'
import { useScraperStore } from '../stores/scraper'
import db, { exportAll, importAll } from '../storage/db'
import { checkRelayHealth } from '../services/cors-proxy'

export function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [addingNew, setAddingNew] = useState(false)
  const [newAdapterName, setNewAdapterName] = useState('')
  const [newAdapterKey, setNewAdapterKey] = useState('')
  const [relayStatus, setRelayStatus] = useState<boolean | null>(null)

  useEffect(() => {
    checkRelayHealth().then(setRelayStatus)
  }, [])

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
    <div className="p-6 overflow-auto h-full space-y-4">
      <h2 className="text-xl font-bold text-content mb-4">Settings</h2>

      {/* Appearance */}
      <div className="bg-surface-card border border-border-main rounded-lg p-4">
        <h3 className="text-sm font-semibold text-content mb-3">Appearance</h3>
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

        <div className="mt-4">
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
      </div>

      {/* CORS Proxy */}
      <div className="bg-surface-card border border-border-main rounded-lg p-4">
        <h3 className="text-sm font-semibold text-content mb-3">CORS Proxy</h3>
        <label className="text-sm font-medium text-content">Proxy URL</label>
        <p className="text-xs text-content-muted mb-2">
          Proxy used to bypass CORS when scraping
        </p>
        <input
          type="text"
          value={settings.proxyUrl}
          onChange={(e) => update({ proxyUrl: e.target.value })}
          placeholder={relayStatus ? 'Leave empty to use Vercel relay (free)' : 'Enter your CORS proxy URL'}
          className="w-full px-3 py-2 bg-surface-input border border-border-main rounded-lg text-sm text-content font-mono"
        />
        <div className="mt-2 space-y-1">
          {relayStatus === true && !settings.proxyUrl && (
            <p className="text-xs text-green-400">
              Using Vercel relay (free, managed by deployment owner)
            </p>
          )}
          {relayStatus === true && settings.proxyUrl && (
            <p className="text-xs text-amber-400">
              Custom proxy configured — Vercel relay is available but not used
            </p>
          )}
          {relayStatus === false && (
            <p className="text-xs text-amber-400">
              Vercel relay unavailable — configure your own proxy below
            </p>
          )}
          <p className="text-xs text-content-muted">
            Leave empty to use the built-in Vercel relay (free, rate-limited). Set a URL to use your own CORS proxy (e.g. corsproxy.io, allorigins.win, or self-hosted).
          </p>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-surface-card border border-border-main rounded-lg p-4">
        <h3 className="text-sm font-semibold text-content mb-1">API Keys</h3>
        <p className="text-xs text-content-muted mb-3">API keys required by some adapters (e.g. for Jamendo)</p>
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
                className="p-2 text-xs text-green-400 hover:text-green-300 cursor-pointer transition-colors"
                title="Save"
              >
                ✓
              </button>
              <button
                onClick={() => { setAddingNew(false); setNewAdapterName(''); setNewAdapterKey('') }}
                className="p-2 text-xs text-content-muted hover:text-content cursor-pointer transition-colors"
                title="Cancel"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="text-xs text-accent hover:text-accent-hover cursor-pointer transition-colors"
            >
              + Add API key
            </button>
          )}
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-surface-card border border-border-main rounded-lg p-4">
        <h3 className="text-sm font-semibold text-content mb-3">Data Management</h3>
        <div className="space-y-2">
          <button
            onClick={handleResetAll}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-btn-danger-text bg-btn-danger-bg border border-btn-danger-text/20 rounded-lg hover:bg-btn-danger-hover cursor-pointer transition-colors"
          >
            <span className="font-medium">Reset All Data</span>
            <span className="text-xs text-content-muted ml-auto">Clears everything including releases</span>
          </button>
          <button
            onClick={handleResetUserData}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-btn-amber-text bg-btn-amber-bg border border-btn-amber-text/20 rounded-lg hover:bg-btn-amber-hover cursor-pointer transition-colors"
          >
            <span className="font-medium">Reset User Data</span>
            <span className="text-xs text-content-muted ml-auto">Clears favorites, history — keeps releases &amp; jobs</span>
          </button>
          <button
            onClick={handleResetScrapeData}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-btn-cyan-text bg-btn-cyan-bg border border-btn-cyan-text/20 rounded-lg hover:bg-btn-cyan-hover cursor-pointer transition-colors"
          >
            <span className="font-medium">Reset Scrape Data</span>
            <span className="text-xs text-content-muted ml-auto">Clears releases and jobs — keeps favorites &amp; history</span>
          </button>
        </div>
      </div>

      {/* Export / Import */}
      <div className="bg-surface-card border border-border-main rounded-lg p-4">
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
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-btn-blue-text bg-btn-blue-bg border border-btn-blue-text/20 rounded-lg hover:bg-btn-blue-hover cursor-pointer transition-colors"
          >
            <span className="font-medium">Export All Data</span>
            <span className="text-xs text-content-muted ml-auto">Download all data as JSON</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-btn-green-text bg-btn-green-bg border border-btn-green-text/20 rounded-lg hover:bg-btn-green-hover cursor-pointer transition-colors"
          >
            <span className="font-medium">Import All Data</span>
            <span className="text-xs text-content-muted ml-auto">Replace current data from JSON file</span>
          </button>
        </div>
      </div>
    </div>
  )
}
