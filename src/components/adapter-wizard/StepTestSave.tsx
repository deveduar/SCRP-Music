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
} from 'lucide-react'
import type { AdapterParseResult, AdapterValidationError } from '../../services/adapter-schema'
import type { AdapterDefinition } from '../../types/adapter-definition'
import type { AdapterTestResult } from '../../services/adapter-tester'
import { AdapterSummary } from './AdapterSummary'
import { AiSourceForm } from './AiSourceForm'
import { buildAiPrompt, emptyAiSourceInput } from '../../services/ai-prompt'
import type { AiSourceInput } from '../../services/ai-prompt'

const invalidClass = 'border-red-500/50'

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
}) {
  const [aiOpen, setAiOpen] = useState(false)
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
      {/* AI generator */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setAiOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
        >
          <Sparkles size={12} />
          {aiOpen ? 'Hide AI generator' : 'Generate with AI (copy a prompt)'}
        </button>
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
                <span className="text-xs text-amber-400">
                  Add the Listing URL (or paste a data sample) first — otherwise the AI would have to
                  invent a fake source that cannot work.
                </span>
              )}
            </div>
            <pre className="w-full max-h-72 overflow-auto bg-surface-input border border-border-main rounded-lg p-3 font-mono text-[11px] text-content-secondary whitespace-pre-wrap break-words">
              {aiPrompt}
            </pre>
          </div>
        )}
      </div>

      {/* Validation */}
      <div
        className={`rounded-lg border px-3 py-2.5 text-xs ${
          valid
            ? 'border-green-500/30 bg-green-500/10 text-green-400'
            : 'border-red-500/30 bg-red-500/10 text-red-400'
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
                <span className="font-mono text-red-300/80">{e.path}</span>: {e.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* JSON editor */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onAdvancedChange(!advanced)}
            className="flex items-center gap-1.5 text-xs text-content-secondary hover:text-content transition-colors cursor-pointer"
          >
            <Braces size={12} />
            {advanced ? 'Hide JSON editor' : 'Show JSON editor'}
          </button>
          {advanced && (
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-surface-secondary border border-border-main text-accent hover:text-accent-hover transition-colors cursor-pointer"
              title="Read the adapter JSON from your clipboard"
            >
              <ClipboardPaste size={11} />
              Paste from clipboard
            </button>
          )}
        </div>
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
              <p className="text-xs text-amber-400">
                Clipboard not available — click the editor and press Ctrl/Cmd+V to paste.
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {jsonDirty ? (
                jsonOk ? (
                  <span className="text-green-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Valid JSON — Test and Save use it, and it is loaded
                    into the form below
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1">
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

      {/* Adapter overview */}
      {valid && <AdapterSummary def={def} />}

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
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <div className="text-amber-300 font-medium">
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
                className={`w-2 h-2 rounded-full shrink-0 ${testResult.ok ? 'bg-green-400' : 'bg-red-400'}`}
              />
              <span className="font-medium text-content-secondary">
                {testResult.ok ? 'Adapter responds' : 'No releases found'} — {testResult.durationMs} ms
              </span>
            </div>
            {testResult.apiKeyMissing && (
              <div className="text-amber-400">
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
                <span className="text-red-400">{testResult.maxPageError ?? 'unknown'}</span>
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
                        s.coverUrl ? 'bg-green-400' : 'bg-amber-400'
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
                <div className="text-red-400">Errors:</div>
                {testResult.errors.map((e, i) => (
                  <div key={i} className="text-red-300/80 break-words">
                    {e}
                  </div>
                ))}
              </div>
            )}
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
        {savedFlash && <p className="text-xs text-green-400">{savedFlash}</p>}
      </div>
    </div>
  )
}
