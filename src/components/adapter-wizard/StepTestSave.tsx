import { useRef, useState } from 'react'
import {
  Play,
  Save,
  CheckCircle2,
  XCircle,
  Braces,
  Sparkles,
  Copy,
  Check,
  ClipboardPaste,
  ExternalLink,
  Globe,
  ChevronRight,
} from 'lucide-react'
import type { AdapterParseResult, AdapterValidationError } from '../../services/adapter-schema'
import type { AdapterDefinition } from '../../types/adapter-definition'
import type { AdapterTestResult } from '../../services/adapter-tester'
import type { GenreUrlCheck } from '../../services/adapter-genre-tester'
import { AdapterSummary } from './AdapterSummary'
import { AiSourceForm } from './AiSourceForm'
import { buildAiPrompt, emptyAiSourceInput } from '../../services/ai-prompt'
import type { AiSourceInput } from '../../services/ai-prompt'

const invalidClass = 'border-btn-red-text/50'

export function StepTestSave({
  valid,
  errors,
  testing,
  testResult,
  savedFlash,
  advanced,
  jsonText,
  jsonDirty,
  jsonParsed,
  def,
  onAdvancedChange,
  onJsonChange,
  onSetFetchMode,
  onTest,
  onSave,
  genreTesting,
  genreResults,
  genreLimit,
  onGenreLimitChange,
  onTestGenres,
}: {
  valid: boolean
  errors: AdapterValidationError[]
  testing: boolean
  testResult: AdapterTestResult | null
  savedFlash?: string
  advanced: boolean
  jsonText: string
  jsonDirty: boolean
  jsonParsed: AdapterParseResult | null
  def: AdapterDefinition
  onAdvancedChange: (v: boolean) => void
  onJsonChange: (text: string, dirty: boolean) => void
  onSetFetchMode?: (mode: 'relay' | 'proxy' | 'direct') => void
  onTest: () => void
  onSave: () => void
  genreTesting: boolean
  genreResults: GenreUrlCheck[] | null
  genreLimit: 'all' | '10' | '1'
  onGenreLimitChange: (v: 'all' | '10' | '1') => void
  onTestGenres: () => void
}) {
  const [aiOpen, setAiOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pasteError, setPasteError] = useState(false)
  const [sourceInput, setSourceInput] = useState<AiSourceInput>(() => emptyAiSourceInput())
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const jsonOk = jsonParsed?.ok ?? false
  const antiBotBlocked =
    testResult !== null &&
    testResult.errors.some((e) => /HTTP 403|HTTP 429|Cloudflare|Attention Required/i.test(e))
  const aiPrompt = buildAiPrompt(sourceInput)
  const canCopy =
    sourceInput.url.trim() !== '' ||
    sourceInput.sampleText.trim() !== '' ||
    sourceInput.detailSampleText.trim() !== ''

  const copyPrompt = () => {
    navigator.clipboard?.writeText(aiPrompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handlePasteClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error('unsupported')
      const text = await navigator.clipboard.readText()
      if (text) {
        onAdvancedChange(true)
        onJsonChange(text, true)
        setPasteError(false)
        return
      }
    } catch {
      /* fall through: focus the editor so the user can Ctrl+V */
    }
    onAdvancedChange(true)
    setPasteError(true)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  return (
    <div className="space-y-4">
      {/* Validation */}
      <div
        className={`rounded-lg border px-3 py-2.5 text-xs ${
          valid
            ? 'border-chip-green-text/30 bg-chip-green-bg text-chip-green-text'
            : 'border-chip-red-text/30 bg-chip-red-bg text-chip-red-text'
        }`}
      >
        <div className="flex items-center gap-2 font-medium">
          {valid ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {valid ? 'Definition is valid' : 'Definition has errors'}
          {jsonDirty && jsonOk && (
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-surface-tertiary text-content-muted border border-border-main">
              Using JSON
            </span>
          )}
        </div>
        {!valid && (
          <div className="mt-1.5 space-y-0.5">
            {(errors ?? []).slice(0, 6).map((e, i) => (
              <div key={i} className="break-words">
                <span className="font-mono text-chip-red-text/80">{e.path}</span>: {e.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adapter overview */}
      {valid && <AdapterSummary def={def} />}

      {/* JSON editor */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onAdvancedChange(!advanced)}
          className="flex items-center gap-1.5 text-sm font-medium text-content hover:text-content-secondary transition-colors cursor-pointer"
        >
          <ChevronRight
            size={14}
            className={`shrink-0 transition-transform ${advanced ? 'rotate-90' : ''}`}
          />
          <Braces size={12} className="text-content-muted" />
          {advanced ? 'Hide JSON editor' : 'Show JSON editor'}
        </button>
        {advanced && (
          <>
            <textarea
              ref={textareaRef}
              value={jsonText}
              onChange={(e) => onJsonChange(e.target.value, true)}
              spellCheck={false}
              placeholder="Paste a valid AdapterDefinition JSON here…"
              className={`w-full h-72 bg-surface-input border rounded-lg p-3 font-mono text-xs text-content resize-y ${
                jsonDirty && jsonParsed && !jsonParsed.ok ? invalidClass : 'border-border-main'
              }`}
            />
            {pasteError && (
              <p className="text-xs text-btn-amber-text">
                Clipboard not available — click the editor and press Ctrl/Cmd+V to paste.
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {jsonDirty ? (
                jsonOk ? (
                  <span className="text-chip-green-text flex items-center gap-1">
                    <CheckCircle2 size={12} /> Valid JSON — Test and Save use it, and it is loaded
                    into the form below
                  </span>
                ) : (
                  <span className="text-chip-red-text flex items-center gap-1">
                    <XCircle size={12} /> Invalid JSON — check the errors above
                  </span>
                )
              ) : (
                <span className="text-content-muted">
                  Generated from the form below. Edits replace the form definition when saved.
                </span>
              )}
            </div>
            {!jsonDirty && (
              <p className="text-xs text-content-muted">
                Tip: paste an adapter JSON here (e.g. generated with AI) to validate it and load it
                into the form automatically.
              </p>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setAiOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-btn-cyan-bg text-btn-cyan-text border border-btn-cyan-text/20 hover:bg-btn-cyan-hover transition-colors cursor-pointer"
        >
          <Sparkles size={12} />
          {aiOpen ? 'Hide AI generator' : 'Generate with AI'}
        </button>
        <button
          type="button"
          onClick={handlePasteClipboard}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-surface-secondary border border-border-main text-content-secondary hover:text-content transition-colors cursor-pointer"
          title="Read the adapter JSON from your clipboard"
        >
          <ClipboardPaste size={12} />
          Paste from clipboard
        </button>
      </div>

      {/* AI generator */}
      {aiOpen && (
        <div className="rounded-lg border border-border-main bg-surface-secondary p-3 space-y-3">
          <p className="text-xs text-content-muted">
            Paste the URL of the site/API you want to scrape (and optionally a single item page) and
            the app downloads a real sample of it into the prompt — filtering out menus and scripts
            so only the actual list or article reaches the AI. The AI analyzes that real data and
            returns the adapter JSON — paste that JSON into the editor to validate and load it. If a
            page can't be reached, inspect it (F12 → Network) and paste the HTML/JSON as the sample.
          </p>
          <AiSourceForm value={sourceInput} onChange={setSourceInput} />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={copyPrompt}
              disabled={!canCopy}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-lg bg-btn-cyan-bg text-btn-cyan-text border border-btn-cyan-text/20 hover:bg-btn-cyan-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy prompt'}
            </button>
            {!canCopy && (
              <span className="text-xs text-btn-amber-text">
                Add the Listing URL (or paste a data sample) first — otherwise the AI would have to
                invent a fake source that cannot work.
              </span>
            )}
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setPromptOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-content-secondary hover:text-content transition-colors cursor-pointer"
            >
              <ChevronRight
                size={12}
                className={`shrink-0 transition-transform ${promptOpen ? 'rotate-90' : ''}`}
              />
              {promptOpen ? 'Hide prompt' : 'Show prompt'}
            </button>
            {promptOpen && (
              <pre className="w-full max-h-72 overflow-auto bg-surface-input border border-border-main rounded-lg p-3 font-mono text-[11px] text-content-secondary whitespace-pre-wrap break-words">
                {aiPrompt}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Test live */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onTest}
          disabled={!valid || testing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-btn-cyan-bg text-btn-cyan-text border border-btn-cyan-text/20 hover:bg-btn-cyan-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Play size={12} />
          {testing ? 'Testing…' : 'Test live'}
        </button>
        <p className="text-xs text-content-muted">
          Scrapes the first genre / first page (capped at 5 releases) to validate the whole adapter.
        </p>
        {testResult && (
          <div className="rounded-lg border border-border-main bg-surface-secondary p-3 space-y-2 text-xs">
            {antiBotBlocked && (
              <div className="rounded-lg border border-btn-amber-text/40 bg-btn-amber-bg p-3 space-y-2">
                <div className="text-btn-amber-text font-medium">
                  This source blocks server-side requests (anti-bot / Cloudflare) — the adapter is
                  fetching via &quot;relay&quot;, which the site rejects with HTTP 403.
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onSetFetchMode?.('proxy')}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-btn-cyan-bg text-btn-cyan-text border border-btn-cyan-text/20 hover:bg-btn-cyan-hover transition-colors cursor-pointer"
                  >
                    Switch to CORS proxy
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetFetchMode?.('direct')}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-btn-cyan-bg text-btn-cyan-text border border-btn-cyan-text/20 hover:bg-btn-cyan-hover transition-colors cursor-pointer"
                  >
                    Switch to direct
                  </button>
                </div>
                <p className="text-content-muted">
                  After switching, run &quot;Test live&quot; again.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${testResult.ok ? 'bg-chip-green-text' : 'bg-chip-red-text'}`}
              />
              <span className="font-medium text-content-secondary">
                {testResult.ok ? 'Adapter responds' : 'No releases found'} — {testResult.durationMs} ms
              </span>
            </div>
            {testResult.apiKeyMissing && (
              <div className="text-btn-amber-text">
                This adapter requires an API key. Add it in Settings → API Keys.
              </div>
            )}
            <div className="text-content-muted">
              Genres: {testResult.genresCount} ({testResult.genresLabel})
            </div>
            <div className="text-content-muted">
              Max pages:{' '}
              {testResult.maxPage !== null ? (
                testResult.maxPage
              ) : (
                <span className="text-chip-red-text">{testResult.maxPageError ?? 'unknown'}</span>
              )}
            </div>
            {testResult.page1Url && (
              <div className="text-content-muted break-words">
                Page 1 URL:{' '}
                <a
                  href={testResult.page1Url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-accent hover:text-accent-hover break-all"
                >
                  {testResult.page1Url}
                  <ExternalLink size={11} className="shrink-0" />
                </a>
              </div>
            )}
            {testResult.responseSnippet && (
              <div>
                <div className="text-content-muted mb-1">Response preview:</div>
                <pre className="max-h-40 overflow-auto bg-surface-input border border-border-main rounded-lg p-2 font-mono text-[11px] text-content-secondary whitespace-pre-wrap break-words">
                  {testResult.responseSnippet}
                </pre>
              </div>
            )}
            {testResult.samples.length > 0 && (
              <div className="space-y-1">
                <div className="text-content-muted">Samples from page 1:</div>
                {testResult.samples.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-content-secondary">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        s.coverUrl ? 'bg-chip-green-text' : 'bg-btn-amber-text'
                      }`}
                      title={s.coverUrl ? 'cover found' : 'no cover'}
                    />
                    <span className="truncate min-w-0">{s.title || '(untitled)'}</span>
                    <span className="ml-auto shrink-0 text-content-muted">
                      {s.downloads} dl{s.coverUrl ? ' · cover' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {testResult.errors.length > 0 && (
              <div className="space-y-0.5">
                <div className="text-chip-red-text">Errors:</div>
                {testResult.errors.map((e, i) => (
                  <div key={i} className="text-chip-red-text/80 break-words">
                    {e}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test genres */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onTestGenres}
            disabled={!valid || genreTesting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-surface-secondary border border-border-main text-content-secondary hover:text-content transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Globe size={12} />
            {genreTesting ? 'Testing genres…' : 'Test genres'}
          </button>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-content-muted">Scope:</span>
            {(['all', '10', '1'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onGenreLimitChange(v)}
                className={`px-2 py-0.5 rounded text-[11px] border transition-colors cursor-pointer ${
                  genreLimit === v
                    ? 'bg-accent/15 text-accent border-accent/30'
                    : 'bg-surface-secondary text-content-muted border-border-main hover:text-content'
                }`}
              >
                {v === 'all' ? 'All' : v}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-content-muted">
          Checks each genre&apos;s page-1 URL with the adapter&apos;s transport — catches broken genre paths
          (e.g. a 404 because the slug was guessed instead of copied).
        </p>
        {genreResults && (
          <div className="rounded-lg border border-border-main bg-surface-secondary p-3 space-y-1.5 text-xs">
            <div className="font-medium text-content-secondary">
              {genreResults.filter((r) => r.ok).length} ok, {genreResults.filter((r) => !r.ok).length} failed
              of {genreResults.length} tested
            </div>
            {genreResults.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-content-secondary">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.ok ? 'bg-chip-green-text' : 'bg-chip-red-text'}`}
                />
                <span className="truncate min-w-0">{r.label}</span>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto shrink-0 inline-flex items-center gap-1 font-mono text-accent hover:text-accent-hover max-w-[45%] min-w-0"
                    title={r.url}
                  >
                    <span className="truncate">{r.url}</span>
                    <ExternalLink size={10} className="shrink-0" />
                  </a>
                )}
                <span
                  className={`shrink-0 ${r.ok ? 'text-chip-green-text' : 'text-chip-red-text'}`}
                  title={r.ok ? undefined : r.error}
                >
                  {r.ok ? 'OK' : r.status ? `HTTP ${r.status}` : 'error'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!valid}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-btn-green-bg text-btn-green-text border border-btn-green-text/20 hover:bg-btn-green-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Save size={12} />
          Save adapter
        </button>
        {savedFlash && <p className="text-xs text-chip-green-text">{savedFlash}</p>}
      </div>
    </div>
  )
}
