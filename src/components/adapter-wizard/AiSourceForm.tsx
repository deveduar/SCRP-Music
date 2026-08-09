import { useState } from 'react'
import { FormField, TextInput, Select, SectionTitle } from '../forms/FormControls'
import type { AiSourceInput } from '../../services/ai-prompt'
import { fetchSourceSamples } from '../../services/source-sample'
import type { SourceSample } from '../../services/source-sample'

const btnClass =
  'flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-lg bg-btn-cyan-bg text-btn-cyan-text border border-btn-cyan-text/20 hover:bg-btn-cyan-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'
const ghostBtnClass =
  'flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-lg border border-border-main text-content-muted hover:text-content transition-colors cursor-pointer'

export function AiSourceForm({
  value,
  onChange,
}: {
  value: AiSourceInput
  onChange: (v: AiSourceInput) => void
}) {
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [lastSample, setLastSample] = useState<SourceSample | null>(null)
  const [lastDetail, setLastDetail] = useState<SourceSample | null>(null)

  const patch = (p: Partial<AiSourceInput>) => onChange({ ...value, ...p })

  const clearSamples = () => {
    patch({
      sampleText: '',
      sampleKind: 'unknown',
      sampleMode: 'none',
      sampleNote: '',
      sampleTransport: '',
      hints: '',
      detailSampleText: '',
      detailSampleKind: 'unknown',
      detailSampleMode: 'none',
      detailSampleNote: '',
      detailSampleTransport: '',
      detailHints: '',
    })
    setLastSample(null)
    setLastDetail(null)
  }

  const handleFetch = async () => {
    const url = value.url.trim()
    const detail = value.detailUrl.trim()
    if (!url || fetching) return
    setFetching(true)
    setFetchError('')
    const { listing, detail: detailSample } = await fetchSourceSamples(url, detail, undefined, {
      maxChars: value.maxChars,
    })
    setFetching(false)
    setLastSample(listing)
    setLastDetail(detailSample)
    if (!listing.ok) {
      setFetchError(listing.error || 'Could not reach the URL')
      return
    }
    patch({
      sampleText: listing.text,
      sampleKind: listing.kind,
      sampleMode: 'fetched',
      sampleNote: listing.note ?? '',
      sampleTransport: listing.mode,
      hints: listing.hints ?? '',
      detailSampleText: detailSample?.ok ? detailSample.text : '',
      detailSampleKind: detailSample?.ok ? detailSample.kind : 'unknown',
      detailSampleMode: detailSample?.ok ? 'fetched' : 'none',
      detailSampleNote: detailSample?.ok ? (detailSample.note ?? '') : '',
      detailSampleTransport: detailSample?.ok ? detailSample.mode : '',
      detailHints: detailSample?.ok ? (detailSample.hints ?? '') : '',
    })
    if (detail && detailSample && !detailSample.ok) {
      setFetchError(
        `The listing sample was downloaded, but the Detail page could not be reached (${detailSample.error ?? 'error'}).`,
      )
    }
  }

  const sampleLabel =
    value.sampleMode === 'fetched'
      ? `Sample downloaded: ${value.sampleKind}, ${value.sampleText.length} chars${
          lastSample?.note ? ` — ${lastSample.note}` : ''
        }`
      : value.sampleMode === 'pasted'
        ? `Sample pasted by you: ${value.sampleKind}, ${value.sampleText.length} chars`
        : 'No sample yet — download it or paste the HTML/JSON below.'

  const detailLabel =
    value.detailSampleMode === 'fetched'
      ? `Detail sample downloaded: ${value.detailSampleKind}, ${value.detailSampleText.length} chars${
          lastDetail?.note ? ` — ${lastDetail.note}` : ''
        }`
      : value.detailUrl.trim()
        ? 'Detail sample: none (will be downloaded with the listing)'
        : ''

  const shellDetected = Boolean(lastSample?.shellDetected || lastDetail?.shellDetected)
  const hasAnySample = value.sampleMode !== 'none' || value.detailSampleMode !== 'none'

  return (
    <div className="space-y-3">
      <SectionTitle hint="Paste the URL of the page or API you want to scrape. The app downloads a real sample of the listing and (if you add one) of a single item page, filters out the menus and scripts, and includes the useful parts in the prompt — so the AI analyzes real data instead of guessing.">
        Your source
      </SectionTitle>

      <FormField
        label="Listing URL"
        required
        help="URL of the page or API that lists the releases (e.g. https://site.com/releases)"
      >
        <TextInput
          value={value.url}
          onChange={(v) => {
            patch({ url: v })
            setLastSample(null)
            setLastDetail(null)
            setFetchError('')
          }}
          placeholder="https://site.com/releases"
        />
      </FormField>

      <FormField
        label="Example item page URL (optional)"
        help="URL of a single release/detail page — downloaded too, so the AI can map cover and downloads"
      >
        <TextInput
          value={value.detailUrl}
          onChange={(v) => {
            patch({
              detailUrl: v,
              detailSampleText: '',
              detailSampleKind: 'unknown',
              detailSampleMode: 'none',
              detailSampleNote: '',
            })
            setLastDetail(null)
          }}
          placeholder="https://site.com/release/some-slug"
        />
      </FormField>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleFetch}
          disabled={!value.url.trim() || fetching}
          className={btnClass}
        >
          {fetching
            ? 'Downloading samples…'
            : value.detailUrl.trim()
              ? 'Download samples (listing + item)'
              : 'Download sample'}
        </button>
        {hasAnySample && (
          <button type="button" onClick={clearSamples} className={ghostBtnClass}>
            Remove samples
          </button>
        )}
      </div>
      {fetching ? (
        <p className="text-xs text-content-muted">Fetching the URL(s) (direct → relay → proxy)…</p>
      ) : fetchError ? (
        <p className="text-xs text-red-400">
          {fetchError} If a page can't be reached, inspect it (F12 → Network → response) and paste the
          HTML/JSON below instead.
        </p>
      ) : (
        <p className="text-xs text-content-muted">
          {sampleLabel}
          {detailLabel && (
            <>
              <br />
              {detailLabel}
            </>
          )}
        </p>
      )}
      {shellDetected && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          This page is rendered with JavaScript — the sample is only the page shell and has no list of
          items. Use a URL that shows the actual list (a playlist, a search page or a list page), or
          inspect the page (F12 → Network → Fetch/XHR) and paste its JSON as the sample.
        </div>
      )}

      {(lastSample?.text || lastDetail?.text) && (
        <details className="rounded-lg border border-border-main bg-surface-input/40 px-3 py-2">
          <summary className="text-xs text-content-muted cursor-pointer select-none">
            Preview raw sample{lastSample?.text ? ` (listing: ${lastSample.text.length} chars)` : ''}
            {lastDetail?.text ? `, detail: ${lastDetail.text.length} chars` : ''} — click to expand
          </summary>
          {lastSample?.text && (
            <div className="mt-2">
              <p className="text-[11px] text-content-muted mb-1">Listing sample:</p>
              <pre className="max-h-72 overflow-auto rounded-lg bg-black/40 border border-border-main p-2 text-[11px] text-content-secondary font-mono whitespace-pre-wrap break-all">
                {lastSample.text}
              </pre>
            </div>
          )}
          {lastDetail?.text && (
            <div className="mt-2">
              <p className="text-[11px] text-content-muted mb-1">Detail sample:</p>
              <pre className="max-h-72 overflow-auto rounded-lg bg-black/40 border border-border-main p-2 text-[11px] text-content-secondary font-mono whitespace-pre-wrap break-all">
                {lastDetail.text}
              </pre>
            </div>
          )}
        </details>
      )}

      <FormField
        label="Paste the page HTML/JSON instead"
        help="Only if the site can't be reached: inspect the page (F12 → Network) and paste the response here."
      >
        <textarea
          value={value.sampleText}
          onChange={(e) => {
            patch({
              sampleText: e.target.value,
              sampleKind: 'unknown',
              sampleMode: 'pasted',
              sampleNote: '',
              hints: '',
            })
            setLastSample(null)
          }}
          rows={5}
          className="w-full bg-surface-input border border-border-main rounded-lg p-2 text-xs text-content-secondary font-mono placeholder:text-content-muted/50 focus:outline-none focus:border-accent/60"
          placeholder="<html>… or { … }"
        />
      </FormField>

      <FormField
        label="Notes (optional)"
        help="Anything in your own words: what the site is, what each item shows…"
      >
        <TextInput
          value={value.notes}
          onChange={(v) => patch({ notes: v })}
          placeholder="It's a music blog with releases split into pages; each release has a cover and a download link…"
        />
      </FormField>

      <details className="rounded-lg border border-border-main bg-surface-input/40 px-3 py-2">
        <summary className="text-xs text-content-muted cursor-pointer select-none">
          Advanced (optional)
        </summary>
        <div className="mt-3 space-y-3">
          <FormField label="Type override" help="Leave Auto — the AI decides from the sample">
            <Select
              value={value.kind}
              onChange={(v) => patch({ kind: v as AiSourceInput['kind'] })}
              options={[
                { value: 'auto', label: 'Auto — the AI decides from the sample' },
                { value: 'api', label: 'It is a JSON API' },
                { value: 'html', label: 'It is a website (HTML)' },
              ]}
            />
          </FormField>
          <FormField label="Sample size (chars)" help="Max chars kept per sample in the prompt. Lower it if the prompt gets too long.">
            <TextInput
              value={String(value.maxChars)}
              onChange={(v) => patch({ maxChars: Number(v) || 0 })}
              placeholder="20000"
            />
          </FormField>
          <FormField label="API key (optional)" help="e.g. header X-Api-Key: xxx or query param key=xxx">
            <TextInput
              value={value.apiKeyHint}
              onChange={(v) => patch({ apiKeyHint: v })}
              placeholder="header X-Api-Key: …"
            />
          </FormField>
          <FormField label="Required headers (optional)" help="e.g. Accept: application/json">
            <TextInput
              value={value.headers}
              onChange={(v) => patch({ headers: v })}
              placeholder="Accept: application/json"
            />
          </FormField>
        </div>
      </details>
    </div>
  )
}
