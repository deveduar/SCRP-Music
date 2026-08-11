import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  Eye,
  X,
  Wand2,
  Sparkles,
  FileJson2,
  ClipboardPaste,
  ChevronRight,
  Download,
  Upload,
} from 'lucide-react'
import { useScraperStore } from '../stores/scraper'
import { useSettingsStore } from '../stores/settings'
import { useNetworkStore } from '../stores/network'
import {
  getAllDefinitions,
  getBuiltinDefinition,
  hasCustomDefinition,
  registerCustomDefinition,
  unregisterCustomDefinition,
} from '../services/adapter-registry'
import { validateAdapterDefinition, parseAdapterJson } from '../services/adapter-schema'
import { createAdapterFromDef } from '../services/adapter-engine'
import { importAdapterDefs } from '../services/adapter-import'
import { testAdapter } from '../services/adapter-tester'
import type { AdapterTestResult } from '../services/adapter-tester'
import { testGenres } from '../services/adapter-genre-tester'
import type { GenreUrlCheck } from '../services/adapter-genre-tester'
import { getFetchInfo } from '../services/fetch-info'
import { getCustomAdapter, getCustomAdapters, saveCustomAdapter, deleteCustomAdapter } from '../storage/db'
import type { AdapterDefinition } from '../types/adapter-definition'
import {
  emptyForm,
  htmlTemplateForm,
  apiTemplateForm,
  definitionToForm,
  formToDefinition,
  normalizeForm,
} from '../services/adapter-form'
import type { AdapterFormState } from '../services/adapter-form'
import { emptyAiSourceInput } from '../services/ai-prompt'
import type { AiSourceInput } from '../services/ai-prompt'
import type { IdCollision } from '../components/adapter-wizard/StepBasics'
import { StepForm } from '../components/adapter-wizard/StepForm'
import { StepFields } from '../components/adapter-wizard/StepFields'
import { StepTestSave } from '../components/adapter-wizard/StepTestSave'

const DRAFT_KEY = 'adapter_wizard_draft'

interface WizardDraft {
  form: AdapterFormState
  aiInput: AiSourceInput
  jsonText: string
  jsonDirty: boolean
  editingId: string | null
  dirty: boolean
  advanced: boolean
  aiOpen: boolean
}

function loadDraft(): WizardDraft | null {
  const draft = localStorage.getItem(DRAFT_KEY)
  if (!draft) return null
  try {
    const parsed = JSON.parse(draft) as {
      form?: unknown
      aiInput?: AiSourceInput
      jsonText?: unknown
      jsonDirty?: unknown
      editingId?: unknown
      dirty?: unknown
      advanced?: unknown
      aiOpen?: unknown
      kind?: unknown
    }
    if (parsed && typeof parsed === 'object' && typeof parsed.form === 'object' && parsed.form !== null && typeof (parsed.form as { kind?: unknown }).kind === 'string') {
      return {
        form: normalizeForm(parsed.form),
        aiInput: parsed.aiInput ?? emptyAiSourceInput(),
        jsonText: typeof parsed.jsonText === 'string' ? parsed.jsonText : '',
        jsonDirty: parsed.jsonDirty === true,
        editingId: typeof parsed.editingId === 'string' ? parsed.editingId : null,
        dirty: parsed.dirty === true,
        advanced: parsed.advanced === true,
        aiOpen: parsed.aiOpen === true,
      }
    }
    if (parsed && typeof parsed === 'object' && typeof parsed.kind === 'string') {
      return {
        form: normalizeForm(parsed),
        aiInput: emptyAiSourceInput(),
        jsonText: '',
        jsonDirty: false,
        editingId: null,
        dirty: false,
        advanced: false,
        aiOpen: false,
      }
    }
  } catch {
    /* ignore corrupted draft */
  }
  return null
}

type AdvTab = 'form' | 'fields'

const ADV_TABS: { id: AdvTab; label: string }[] = [
  { id: 'form', label: 'Form' },
  { id: 'fields', label: 'Field Mapping' },
]

export function Adapters() {
  const adapters = useScraperStore((s) => s.adapters)
  const activeAdapterId = useScraperStore((s) => s.activeAdapterId)
  const registerAdapter = useScraperStore((s) => s.registerAdapter)
  const setActiveAdapter = useScraperStore((s) => s.setActiveAdapter)
  const removeAdapter = useScraperStore((s) => s.removeAdapter)
  const settings = useSettingsStore((s) => s.settings)
  const network = useNetworkStore()

  const [list, setList] = useState<AdapterDefinition[]>(() => getAllDefinitions())
  const [form, setForm] = useState<AdapterFormState>(() => loadDraft()?.form ?? emptyForm())
  const [aiInput, setAiInput] = useState<AiSourceInput>(() => loadDraft()?.aiInput ?? emptyAiSourceInput())
  const [wizardOpen, setWizardOpen] = useState(() => Boolean(localStorage.getItem(DRAFT_KEY)))
  const [advOpen, setAdvOpen] = useState(false)
  const [advTab, setAdvTab] = useState<AdvTab>('form')
  const [editingId, setEditingId] = useState<string | null>(() => loadDraft()?.editingId ?? null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<AdapterTestResult | null>(null)
  const [genreTesting, setGenreTesting] = useState(false)
  const [genreResults, setGenreResults] = useState<GenreUrlCheck[] | null>(null)
  const [genreLimit, setGenreLimit] = useState<'all' | '10' | '1'>('10')
  const [savedFlash, setSavedFlash] = useState<string | null>(null)
  const [viewing, setViewing] = useState<AdapterDefinition | null>(null)
  const [advanced, setAdvanced] = useState(() => loadDraft()?.advanced ?? false)
  const [aiOpen, setAiOpen] = useState(() => loadDraft()?.aiOpen ?? false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [jsonText, setJsonText] = useState(() => loadDraft()?.jsonText ?? '')
  const [jsonDirty, setJsonDirty] = useState(() => loadDraft()?.jsonDirty ?? false)
  const [dirty, setDirty] = useState(() => loadDraft()?.dirty ?? false)

  useEffect(() => {
    const t = setTimeout(
      () =>
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ form, aiInput, jsonText, jsonDirty, editingId, dirty, advanced, aiOpen }),
        ),
      400,
    )
    return () => clearTimeout(t)
  }, [form, aiInput, jsonText, jsonDirty, editingId, dirty, advanced, aiOpen])

  useEffect(() => {
    if (!jsonDirty && jsonText !== '') {
      setJsonText(JSON.stringify(formToDefinition(form), null, 2))
    }
  }, [form, jsonDirty, jsonText])

  const unsaved = wizardOpen && dirty

  const discardGuard = (): boolean => {
    if (!unsaved) return true
    return window.confirm('You have unsaved changes in the adapter editor. Discard them and continue?')
  }

  useEffect(() => {
    if (!unsaved) return
    const handler = (e: BeforeUnloadEvent) => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ form, aiInput, jsonText, jsonDirty, editingId, dirty, advanced, aiOpen }),
      )
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [unsaved, form, aiInput, jsonText, jsonDirty, editingId, dirty, advanced, aiOpen])

  const patch = (p: Partial<AdapterFormState>) => {
    setJsonDirty(false)
    setGenreResults(null)
    setSavedFlash(null)
    setDirty(true)
    setForm((s) => ({ ...s, ...p }))
  }

  const def = useMemo(() => formToDefinition(form), [form])

  const jsonParsed = useMemo(
    () => (jsonDirty ? parseAdapterJson(jsonText) : null),
    [jsonDirty, jsonText],
  )
  const useJson = jsonDirty && jsonParsed?.ok === true
  const effectiveDef = useMemo(
    () => (useJson && jsonParsed?.def ? jsonParsed.def : def),
    [useJson, jsonParsed, def],
  )
  const effectiveValidation = useMemo(() => validateAdapterDefinition(effectiveDef), [effectiveDef])
  const effectiveValid = effectiveValidation.ok
  const effectiveErrors = useMemo(() => {
    if (useJson) return jsonParsed?.errors ?? []
    return effectiveValidation.errors ?? []
  }, [useJson, jsonParsed, effectiveValidation])

  useEffect(() => {
    if (jsonDirty && jsonParsed?.ok && jsonParsed.def) {
      const d = jsonParsed.def
      setForm(normalizeForm(definitionToForm(d)))
      setEditingId(hasCustomDefinition(d.id) ? d.id : null)
      setTestResult(null)
      setSavedFlash(null)
    }
  }, [jsonDirty, jsonParsed])

  const handleAdvancedChange = (v: boolean) => setAdvanced(v)

  const reload = () => setList(getAllDefinitions())

  const collision: IdCollision | null = useMemo(() => {
    if (!form.id) return null
    const builtin = getBuiltinDefinition(form.id)
    if (builtin) return { type: 'builtin', name: builtin.name }
    const existing = list.find((d) => d.id === form.id && hasCustomDefinition(d.id))
    if (existing && existing.id !== editingId) return { type: 'custom', name: existing.name }
    return null
  }, [form.id, list, editingId])

  const existingIds = useMemo(
    () => list.filter((d) => d.id !== editingId).map((d) => d.id),
    [list, editingId],
  )

  const fetchInfo = useMemo(() => {
    if (!form.id) return null
    return getFetchInfo(form.id, {
      env: network.env,
      relayAvailable: network.relayAvailable,
      proxyUrl: settings.proxyUrl,
    })
  }, [form.id, network, settings])

  const uniqueId = (base: string): string => {
    if (!list.some((d) => d.id === base)) return base
    let i = 2
    while (list.some((d) => d.id === `${base}-${i}`)) i++
    return `${base}-${i}`
  }

  const startWizard = (f: AdapterFormState, editId: string | null, opts?: { ai?: boolean }) => {
    setForm(f)
    setEditingId(editId)
    setAdvOpen(false)
    setAdvTab('form')
    setTestResult(null)
    setSavedFlash(null)
    setViewing(null)
    setAdvanced(false)
    setAiOpen(opts?.ai ?? false)
    setAiInput(emptyAiSourceInput())
    setJsonDirty(false)
    setJsonText(JSON.stringify(formToDefinition(f), null, 2))
    setDirty(false)
    setWizardOpen(true)
  }

  const startIntro = () => {
    if (!discardGuard()) return
    setViewing(null)
    setWizardOpen(false)
    setTestResult(null)
    setSavedFlash(null)
    setAiOpen(false)
    setAiInput(emptyAiSourceInput())
    setDirty(false)
    localStorage.removeItem(DRAFT_KEY)
  }

  const startPasteJson = () => {
    setForm(emptyForm())
    setEditingId(null)
    setAdvOpen(false)
    setAdvTab('form')
    setTestResult(null)
    setSavedFlash(null)
    setViewing(null)
    setAdvanced(false)
    setAiOpen(false)
    setAiInput(emptyAiSourceInput())
    setJsonDirty(false)
    setJsonText('')
    setDirty(false)
    setWizardOpen(true)
  }

  const startNew = (type: 'empty' | 'html' | 'api') => {
    startWizard(
      type === 'html' ? htmlTemplateForm() : type === 'api' ? apiTemplateForm() : emptyForm(),
      null,
    )
  }

  const startFromAi = () => {
    startWizard(emptyForm(), null, { ai: true })
  }

  const handleUseAsTemplate = (d: AdapterDefinition) => {
    if (!discardGuard()) return
    const f = definitionToForm(d)
    f.id = uniqueId(d.id)
    f.name = `${d.name} (copy)`
    startWizard(normalizeForm(f), null)
  }

  const handleEdit = (d: AdapterDefinition) => {
    if (!discardGuard()) return
    startWizard(definitionToForm(d), d.id)
  }

  const handleTest = async () => {
    if (!effectiveValid) return
    setTesting(true)
    setTestResult(null)
    setGenreResults(null)
    try {
      const res = await testAdapter(effectiveDef)
      setTestResult(res)
    } catch (e) {
      setTestResult({
        ok: false,
        genresCount: 0,
        genresLabel: '',
        maxPage: null,
        samples: [],
        errors: [(e as Error).message],
        durationMs: 0,
        apiKeyMissing: false,
      })
    } finally {
      setTesting(false)
    }
  }

  const handleTestGenres = async () => {
    if (!effectiveValid) return
    setGenreTesting(true)
    setGenreResults(null)
    try {
      const limit = genreLimit === 'all' ? undefined : Number(genreLimit)
      setGenreResults(await testGenres(effectiveDef, { limit }))
    } catch (e) {
      setGenreResults([{ id: '', label: 'Error', url: '', ok: false, error: (e as Error).message }])
    } finally {
      setGenreTesting(false)
    }
  }

  const handleSave = async (d: AdapterDefinition) => {
    const v = validateAdapterDefinition(d)
    if (!v.ok || !v.def) return
    const target = v.def
    const builtin = getBuiltinDefinition(target.id)
    if (builtin) {
      const ok = window.confirm(
        `The id «${target.id}» matches the built-in adapter «${builtin.name}». Saving will override it in your app. Continue?`,
      )
      if (!ok) return
    }
    const now = new Date().toISOString()
    const prev = await getCustomAdapter(target.id)
    await saveCustomAdapter({
      id: target.id,
      name: target.name,
      def: target,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    })
    registerCustomDefinition(target)
    registerAdapter(createAdapterFromDef(target) as never)
    setActiveAdapter(target.id)
    useSettingsStore.getState().update({ activeAdapterId: target.id })
    setEditingId(target.id)
    reload()
    localStorage.removeItem(DRAFT_KEY)
    setDirty(false)
    setSavedFlash(`«${target.name}» saved and activated`)
  }

  const handleDelete = async (d: AdapterDefinition) => {
    const ok = window.confirm(
      `Delete custom adapter «${d.name}» (id: ${d.id})? This cannot be undone.`,
    )
    if (!ok) return
    await deleteCustomAdapter(d.id)
    unregisterCustomDefinition(d.id)
    const builtin = getBuiltinDefinition(d.id)
    removeAdapter(d.id)
    if (builtin) {
      registerAdapter(createAdapterFromDef(builtin) as never)
    }
    const store = useScraperStore.getState()
    if (store.activeAdapterId === d.id) {
      if (builtin) {
        setActiveAdapter(d.id)
      } else {
        const ids = Object.keys(store.adapters)
        if (ids.length > 0) setActiveAdapter(ids[0])
      }
    }
    if (editingId === d.id) {
      setForm(emptyForm())
      setEditingId(null)
      setAdvOpen(false)
      setAdvTab('form')
      setTestResult(null)
      setSavedFlash(null)
      setAiInput(emptyAiSourceInput())
      setJsonDirty(false)
      setJsonText('')
      setDirty(false)
    }
    reload()
  }

  const handleDownloadJson = (d: AdapterDefinition) => {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${d.id}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleExportAdapters = async () => {
    const entries = await getCustomAdapters()
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      adapters: entries.map((e) => e.def),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `scrp-music-adapters-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleImportAdapters = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const result = await importAdapterDefs(parsed)
      reload()
      alert(`Import finished: ${result.imported} imported, ${result.skipped} skipped (id already exists), ${result.invalid} invalid.`)
    } catch (err) {
      alert('Import failed: ' + (err as Error).message)
    }
    e.target.value = ''
  }

  return (
    <div className="p-6 overflow-auto h-full space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold text-content">Adapters</h2>
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-surface-tertiary text-content-muted border border-border-main">
          Builder
        </span>
        {fetchInfo && (
          <span className="text-xs text-content-muted ml-auto">
            Transport: <span className="text-content-secondary">{fetchInfo.label}</span>
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
        {/* Definitions list */}
        <div className="bg-surface-card border border-border-main rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-content">Definitions</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportAdapters}
                className="flex items-center gap-1 text-xs text-content-secondary hover:text-content transition-colors cursor-pointer"
                title="Export custom adapters as JSON"
              >
                <Download size={12} />
                Export
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-xs text-content-secondary hover:text-content transition-colors cursor-pointer"
                title="Import adapters from JSON"
              >
                <Upload size={12} />
                Import
              </button>
              <button
                onClick={startIntro}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover cursor-pointer transition-colors"
              >
                <Plus size={12} />
                New
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleImportAdapters}
          />
          <div className="text-[11px] text-content-muted -mt-1 mb-1">
            Built-ins are read-only. Use «Use as template» to create your own copy.
          </div>
          {list.map((d) => {
            const custom = hasCustomDefinition(d.id)
            const active = activeAdapterId === d.id
            const selected = editingId === d.id
            return (
              <div
                key={d.id}
                className={`px-2.5 py-2 rounded-lg border ${
                  selected
                    ? 'bg-surface-tertiary border-accent/40'
                    : 'bg-surface-secondary border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm text-content truncate">{d.name}</span>
                  <span
                    className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${
                      custom
                        ? 'bg-chip-green-bg text-chip-green-text border border-chip-green-text/30'
                        : 'bg-surface-tertiary text-content-muted border border-border-main'
                    }`}
                  >
                    {custom ? 'Custom' : 'Built-in'}
                  </span>
                  {active && (
                    <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/30 shrink-0">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-xs text-content-muted font-mono mt-0.5 truncate">
                  {d.id} · {d.kind} · {d.fetch.mode} · {d.pagination.detection} ·{' '}
                  {d.genres.items?.length ?? d.genres.fallbackItems?.length ?? 0} genres
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  {custom ? (
                    <>
                      <button
                        onClick={() => handleEdit(d)}
                        className="flex items-center gap-1 text-xs text-content-secondary hover:text-content transition-colors cursor-pointer"
                      >
                        <Pencil size={11} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(d)}
                        className="flex items-center gap-1 text-xs text-btn-red-text hover:text-btn-red-hover transition-colors cursor-pointer"
                      >
                        <Trash2 size={11} />
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleUseAsTemplate(d)}
                      className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
                      title="Load a copy into the wizard"
                    >
                      <Wand2 size={11} />
                      Use as template
                    </button>
                  )}
                  <button
                    onClick={() => setViewing(d)}
                    className="ml-auto flex items-center gap-1 text-xs text-content-secondary hover:text-content transition-colors cursor-pointer"
                  >
                    <Eye size={11} />
                    JSON
                  </button>
                </div>
              </div>
            )
          })}
          {list.length === 0 && (
            <p className="text-xs text-content-muted">No adapter definitions loaded.</p>
          )}
          <div className="text-xs text-content-muted pt-2 border-t border-border-main">
            {Object.keys(adapters).length} registered in the scraper
            {activeAdapterId ? ` · active: ${adapters[activeAdapterId]?.name ?? activeAdapterId}` : ''}
          </div>
        </div>

        {/* Editor / wizard */}
        <div className="bg-surface-card border border-border-main rounded-lg p-4 space-y-3 min-w-0">
          {viewing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-content">JSON — {viewing.name}</h3>
                <button
                  onClick={() => setViewing(null)}
                  className="ml-auto flex items-center gap-1 text-xs text-content-secondary hover:text-content transition-colors cursor-pointer"
                >
                  <X size={12} />
                  Close
                </button>
              </div>
              <pre className="w-full max-h-96 overflow-auto bg-surface-input border border-border-main rounded-lg p-3 font-mono text-xs text-content">
                {JSON.stringify(viewing, null, 2)}
              </pre>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleUseAsTemplate(viewing)
                    setViewing(null)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-btn-cyan-bg text-btn-cyan-text border border-btn-cyan-text/20 hover:bg-btn-cyan-hover transition-colors cursor-pointer"
                >
                  <Copy size={12} />
                  Use as template
                </button>
                <button
                  onClick={() => handleDownloadJson(viewing)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-surface-secondary border border-border-main text-content-secondary hover:text-content transition-colors cursor-pointer"
                >
                  <Download size={12} />
                  Download JSON
                </button>
              </div>
            </div>
          ) : !wizardOpen ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <FileJson2 className="w-10 h-10 text-content-muted" />
              <div>
                <p className="text-content font-medium">Create a new adapter</p>
                <p className="text-content-muted text-sm mt-1 max-w-sm">
                  Build a source step by step without writing code, start from a built-in template, or
                  generate a ready-to-paste JSON with AI.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={startFromAi}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-btn-cyan-bg text-btn-cyan-text border border-btn-cyan-text/20 hover:bg-btn-cyan-hover transition-colors cursor-pointer"
                >
                  <Sparkles size={12} />
                  Generate with AI
                </button>
                <button
                  onClick={() => startNew('empty')}
                  className="px-3 py-1.5 text-xs rounded-lg bg-btn-green-bg text-btn-green-text border border-btn-green-text/20 hover:bg-btn-green-hover transition-colors cursor-pointer"
                >
                  Start from scratch
                </button>
                <button
                  onClick={() => startNew('html')}
                  className="px-3 py-1.5 text-xs rounded-lg bg-surface-secondary border border-border-main text-content-secondary hover:text-content transition-colors cursor-pointer"
                >
                  HTML template
                </button>
                <button
                  onClick={() => startNew('api')}
                  className="px-3 py-1.5 text-xs rounded-lg bg-surface-secondary border border-border-main text-content-secondary hover:text-content transition-colors cursor-pointer"
                >
                  API template
                </button>
                <button
                  onClick={startPasteJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-surface-secondary border border-border-main text-content-secondary hover:text-content transition-colors cursor-pointer"
                  title="Paste an adapter JSON (e.g. generated with AI) to validate and save it"
                >
                  <ClipboardPaste size={12} />
                  Paste JSON
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-content">
                  {editingId ? `Edit «${form.name || editingId}»` : `New adapter ${form.id ? `«${form.id}»` : ''}`}
                </h3>
                {unsaved && (
                  <span className="ml-auto text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full border bg-btn-amber-bg text-btn-amber-text border-btn-amber-text/30">
                    Unsaved
                  </span>
                )}
                <span
                  className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full border ${
                    effectiveValid
                      ? 'bg-chip-green-bg text-chip-green-text border-chip-green-text/30'
                      : 'bg-chip-red-bg text-chip-red-text border-chip-red-text/30'
                  }`}
                >
                  {effectiveValid ? 'Valid' : `${effectiveErrors.length} issue(s)`}
                </span>
                {!editingId && (
                  <button
                    type="button"
                    onClick={startIntro}
                    className="flex items-center gap-1 text-xs text-content-secondary hover:text-content transition-colors cursor-pointer"
                    title="Close the editor and return to the start screen"
                  >
                    <X size={12} />
                    Close
                  </button>
                )}
              </div>

              {/* Main panel: JSON & Test */}
              <StepTestSave
                valid={effectiveValid}
                errors={effectiveErrors}
                testing={testing}
                testResult={testResult}
                advanced={advanced}
                aiOpen={aiOpen}
                onAiOpenChange={setAiOpen}
                aiInput={aiInput}
                onAiInputChange={(v) => {
                  setAiInput(v)
                  setSavedFlash(null)
                  setDirty(true)
                }}
                jsonText={jsonText}
                jsonDirty={jsonDirty}
                jsonParsed={jsonParsed}
                def={effectiveDef}
                onAdvancedChange={handleAdvancedChange}
                onJsonChange={(text, dirtyFlag) => {
                  setJsonText(text)
                  setJsonDirty(dirtyFlag)
                  setSavedFlash(null)
                  setDirty(true)
                }}
                onSetFetchMode={(mode) => {
                  setTestResult(null)
                  patch({ fetchMode: mode })
                }}
                onTest={handleTest}
                onSave={() => handleSave(effectiveDef)}
                savedFlash={savedFlash ?? undefined}
                genreTesting={genreTesting}
                genreResults={genreResults}
                genreLimit={genreLimit}
                onGenreLimitChange={setGenreLimit}
                onTestGenres={handleTestGenres}
              />

              {/* Advanced (collapsible) */}
              <div className="border-t border-border-main pt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setAdvOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-content hover:text-content-secondary transition-colors cursor-pointer"
                >
                  <ChevronRight
                    size={14}
                    className={`shrink-0 transition-transform ${advOpen ? 'rotate-90' : ''}`}
                  />
                  Advanced — full form & field mapping
                </button>
                {advOpen && (
                  <>
                    <div className="flex items-center gap-1">
                      {ADV_TABS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setAdvTab(t.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                            advTab === t.id
                              ? 'bg-accent/15 text-accent border border-accent/30'
                              : 'text-content-secondary hover:text-content border border-transparent'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {advTab === 'form' ? (
                      <StepForm form={form} patch={patch} collision={collision} existingIds={existingIds} />
                    ) : (
                      <StepFields form={form} patch={patch} />
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
