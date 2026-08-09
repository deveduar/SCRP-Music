import { FormField, TextInput, Select, Toggle, SectionTitle, SmallButton } from '../forms/FormControls'
import type { AdapterFormState, FormHeaderRow } from '../../services/adapter-form'
import { slugify } from '../../services/adapter-form'

export interface IdCollision {
  type: 'builtin' | 'custom'
  name: string
}

export function StepBasics({
  form,
  patch,
  collision,
  existingIds,
}: {
  form: AdapterFormState
  patch: (p: Partial<AdapterFormState>) => void
  collision: IdCollision | null
  existingIds: string[]
}) {
  return (
    <div className="space-y-4">
      <SectionTitle hint="Identify your source. The id is used internally and cannot contain spaces.">
        Source details
      </SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" required help="Human-friendly name shown across the app">
          <TextInput
            value={form.name}
            onChange={(v) => {
              patch({ name: v })
              if (!form.id || form.id === slugify(form.name)) {
                patch({ id: slugify(v) })
              }
            }}
            placeholder="e.g. My Music Blog"
          />
        </FormField>
        <FormField label="Adapter id" required help="Unique key used to persist and register the adapter">
          <TextInput
            value={form.id}
            onChange={(v) => patch({ id: slugify(v) })}
            placeholder="e.g. mymusicblog"
          />
        </FormField>
      </div>
      {collision && (
        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          The id «{form.id}» matches the {collision.type} adapter «{collision.name}». Saving will
          override it — consider using a different id.
        </div>
      )}
      {!collision && form.id && existingIds.includes(form.id) && (
        <div className="text-xs text-red-400">
          This id is already used by another adapter in the list.
        </div>
      )}
      <FormField label="Description" help="Short description of the source">
        <TextInput
          value={form.description}
          onChange={(v) => patch({ description: v })}
          placeholder="e.g. Electronic music releases blog"
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Type" required help="HTML pages or a JSON API">
          <Select
            value={form.kind}
            onChange={(v) => patch({ kind: v as 'html' | 'api' })}
            options={[
              { value: 'html', label: 'HTML website' },
              { value: 'api', label: 'JSON API' },
            ]}
          />
        </FormField>
        <FormField label="Base URL" required help="Root of the site (used to resolve relative URLs)">
          <TextInput
            value={form.baseUrl}
            onChange={(v) => patch({ baseUrl: v })}
            placeholder="https://example.com"
          />
        </FormField>
      </div>
      <Toggle
        checked={form.supportsFastSkipExisting}
        onChange={(v) => patch({ supportsFastSkipExisting: v })}
        label="Fast-skip already scraped releases"
        help="Lets the scraper skip releases it already has without visiting them"
      />
    </div>
  )
}

export function StepTransport({
  form,
  patch,
}: {
  form: AdapterFormState
  patch: (p: Partial<AdapterFormState>) => void
}) {
  const setHeaders = (headers: FormHeaderRow[]) => patch({ fetchHeaders: headers })

  return (
    <div className="space-y-4">
      <SectionTitle hint="How network requests are performed. The relay is a server-side fetch that Cloudflare-protected sites often block with HTTP 403 — if a site rejects the relay, use CORS proxy or direct instead.">
        Transport mode
      </SectionTitle>
      <FormField label="Mode" required>
        <Select
          value={form.fetchMode}
          onChange={(v) => patch({ fetchMode: v as 'relay' | 'proxy' | 'direct' })}
          options={[
            { value: 'relay', label: 'Relay (built-in server-side proxy)' },
            { value: 'proxy', label: 'CORS proxy (public proxy — HTML and JSON)' },
            { value: 'direct', label: 'Direct (browser fetch — needs permissive CORS)' },
          ]}
        />
      </FormField>
      {form.fetchMode === 'relay' && (
        <>
          <p className="text-xs text-content-muted">
            Server-side (Node) fetch via the app&apos;s relay. Best when the site blocks public CORS proxies,
            but Cloudflare-protected sites reject it with HTTP 403 — if that happens, switch to CORS proxy or direct.
          </p>
          <FormField label="Relay base path" help="Path of the relay endpoint served by the app">
            <TextInput value={form.relayBase} onChange={(v) => patch({ relayBase: v })} />
          </FormField>
        </>
      )}
      {form.fetchMode === 'direct' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Timeout (ms)" help="Abort the request after this time">
              <TextInput value={form.fetchTimeout} onChange={(v) => patch({ fetchTimeout: v })} placeholder="30000" />
            </FormField>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-content">Headers</span>
              <SmallButton tone="accent" onClick={() => setHeaders([...form.fetchHeaders, { key: '', value: '' }])}>
                + Add header
              </SmallButton>
            </div>
            {form.fetchHeaders.length === 0 && (
              <p className="text-xs text-content-muted">No custom headers. The engine sends Accept: application/json.</p>
            )}
            <div className="space-y-2">
              {form.fetchHeaders.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TextInput
                    value={h.key}
                    onChange={(v) => setHeaders(form.fetchHeaders.map((x, j) => (j === i ? { ...x, key: v } : x)))}
                    placeholder="Header name"
                    className="flex-1"
                  />
                  <TextInput
                    value={h.value}
                    onChange={(v) => setHeaders(form.fetchHeaders.map((x, j) => (j === i ? { ...x, value: v } : x)))}
                    placeholder="Value"
                    className="flex-1"
                  />
                  <SmallButton tone="red" onClick={() => setHeaders(form.fetchHeaders.filter((_, j) => j !== i))}>
                    Remove
                  </SmallButton>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {form.fetchMode === 'proxy' && (
        <p className="text-xs text-content-muted">
          Uses the CORS proxy configured in Settings (works for HTML and JSON). The URL sent to the proxy is built automatically.
        </p>
      )}
    </div>
  )
}
