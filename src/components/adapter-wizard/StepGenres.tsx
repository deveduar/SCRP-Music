import { FormField, TextInput, Select, SectionTitle, SmallButton } from '../forms/FormControls'
import type { AdapterFormState, FormGenreRow } from '../../services/adapter-form'
import { slugify } from '../../services/adapter-form'

const PLACEHOLDERS = [
  { token: '{genreId}', hint: 'genre id' },
  { token: '{path}', hint: 'genre path' },
  { token: '{query}', hint: 'genre query' },
  { token: '{page}', hint: 'page number' },
  { token: '{offset}', hint: 'offset' },
  { token: '{pageSize}', hint: 'page size' },
]

function resolveUrl(template: string, baseUrl: string, sample: Record<string, string>): string {
  let t = template
  for (const [k, v] of Object.entries(sample)) t = t.split(`{${k}}`).join(v)
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  const root = baseUrl.replace(/\/+$/, '')
  return t.startsWith('/') ? root + t : `${root}/${t}`
}

function GenreRowsEditor({
  rows,
  onChange,
  label,
}: {
  rows: FormGenreRow[]
  onChange: (rows: FormGenreRow[]) => void
  label: string
}) {
  const setRow = (i: number, patch: Partial<FormGenreRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-content">{label}</span>
        <SmallButton tone="accent" onClick={() => onChange([...rows, { id: '', label: '', path: '', query: '' }])}>
          + Add genre
        </SmallButton>
      </div>
      {rows.length === 0 && <p className="text-xs text-content-muted">No genres yet.</p>}
      <div className="space-y-2">
        {rows.map((g, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <TextInput
              value={g.label}
              onChange={(v) => {
                setRow(i, { label: v })
                if (!g.id || g.id === slugify(rows[i].label)) setRow(i, { label: v, id: slugify(v) })
              }}
              placeholder="Label"
              className="flex-1 min-w-32"
            />
            <TextInput
              value={g.id}
              onChange={(v) => setRow(i, { id: slugify(v) })}
              placeholder="id"
              className="flex-1 min-w-28 font-mono"
            />
            <TextInput
              value={g.path}
              onChange={(v) => setRow(i, { path: v })}
              placeholder="path"
              className="flex-1 min-w-28 font-mono"
            />
            <TextInput
              value={g.query}
              onChange={(v) => setRow(i, { query: v })}
              placeholder="query"
              className="flex-1 min-w-28 font-mono"
            />
            <SmallButton tone="red" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              Remove
            </SmallButton>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StepGenres({
  form,
  patch,
}: {
  form: AdapterFormState
  patch: (p: Partial<AdapterFormState>) => void
}) {
  return (
    <div className="space-y-4">
      <SectionTitle hint="Which categories to scrape. Each genre maps to a path or query on the site.">
        Genres
      </SectionTitle>
      <FormField label="Source">
        <Select
          value={form.genreSource}
          onChange={(v) => patch({ genreSource: v as 'hardcoded' | 'dynamic' })}
          options={[
            { value: 'hardcoded', label: 'Fixed list (define below)' },
            { value: 'dynamic', label: 'Fetched from the site (URL + regex)' },
          ]}
        />
      </FormField>
      {form.genreSource === 'hardcoded' ? (
        <GenreRowsEditor
          rows={form.genreItems}
          onChange={(rows) => patch({ genreItems: rows })}
          label="Genre list"
        />
      ) : (
        <>
          <FormField label="Genres URL" required help="URL that lists the available genres">
            <TextInput
              value={form.dynamicUrl}
              onChange={(v) => patch({ dynamicUrl: v })}
              placeholder="https://example.com/genres.html"
            />
          </FormField>
          <FormField
            label="Regex"
            help={'Groups: 1 = id, 2 = label, 3 = path. Example: "id"\\s*:\\s*(\\d+)\\s*,\\s*"genre"\\s*:\\s*"([^"]+)"'}
          >
            <TextInput value={form.dynamicRegex} onChange={(v) => patch({ dynamicRegex: v })} />
          </FormField>
          <div className="pt-2">
            <GenreRowsEditor
              rows={form.genreItems}
              onChange={(rows) => patch({ genreItems: rows })}
              label="Fallback genres (used if the dynamic fetch fails)"
            />
          </div>
        </>
      )}
    </div>
  )
}

export function StepPagination({
  form,
  patch,
}: {
  form: AdapterFormState
  patch: (p: Partial<AdapterFormState>) => void
}) {
  return (
    <div className="space-y-4">
      <SectionTitle hint="How the number of pages is detected and how the page URL is built.">
        Pagination
      </SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Detection method" required>
          <Select
            value={form.paginationDetection}
            onChange={(v) => patch({ paginationDetection: v })}
            options={[
              { value: 'html-last-page', label: 'Last page in HTML (fastest)' },
              { value: 'binary-search', label: 'Binary search (no page markers)' },
              { value: 'api-count', label: 'API total count' },
              { value: 'client-side', label: 'Client-side (fetch all)' },
            ]}
          />
        </FormField>
        <FormField label="Pagination mode" required>
          <Select
            value={form.paginationMode}
            onChange={(v) => patch({ paginationMode: v })}
            options={[
              { value: 'page-number', label: 'Page number ({page})' },
              { value: 'offset', label: 'Offset ({offset})' },
              { value: 'client-side', label: 'None (client-side)' },
            ]}
          />
        </FormField>
      </div>
      {form.paginationMode === 'page-number' && form.kind === 'html' && (
        <p className="text-xs text-content-muted -mt-2">
          The Page URL template must contain {`{page}`}. For path-style pages use e.g.{' '}
          <span className="font-mono">/list/{`{page}`}/</span>, for query-style pages e.g.{' '}
          <span className="font-mono">/list?page={`{page}`}</span>.
        </p>
      )}
      {form.paginationMode === 'page-number' && form.kind === 'api' && (
        <p className="text-xs text-content-muted -mt-2">
          The Page URL template must contain {`{page}`}. Most APIs use a query parameter:{' '}
          <span className="font-mono">/search?q={`{query}`}&amp;page={`{page}`}</span>.
        </p>
      )}
      {form.paginationMode === 'offset' && (
        <p className="text-xs text-content-muted -mt-2">
          The Page URL template must contain {`{offset}`} (page 2 = offset {`{pageSize}`}, page 3 =
          offset {`{pageSize}`}×2, …).
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Page size" required help="Releases/items per page">
          <TextInput value={form.pageSize} onChange={(v) => patch({ pageSize: v })} placeholder="20" />
        </FormField>
        <FormField label="Max pages cap" help="Safety limit for the detection (default 5000)">
          <TextInput value={form.maxPagesCap} onChange={(v) => patch({ maxPagesCap: v })} placeholder="5000" />
        </FormField>
      </div>
      {form.paginationDetection === 'html-last-page' && (
        <FormField
          label="Last page regex"
          required
          help="Regex that finds the biggest page number. Example: page/([0-9]+)/"
        >
          <TextInput value={form.lastPageRegex} onChange={(v) => patch({ lastPageRegex: v })} />
        </FormField>
      )}
      {form.paginationDetection === 'api-count' && (
        <FormField label="Total count field path" help="JSON path with the total number of results">
          <TextInput
            value={form.countFieldPath}
            onChange={(v) => patch({ countFieldPath: v })}
            placeholder="response.total"
          />
        </FormField>
      )}
    </div>
  )
}

export function StepUrls({
  form,
  patch,
}: {
  form: AdapterFormState
  patch: (p: Partial<AdapterFormState>) => void
}) {
  return (
    <div className="space-y-4">
      <SectionTitle hint="Templates relative to the base URL. Click a placeholder to insert it.">
        URL templates
      </SectionTitle>
      <div className="flex items-center gap-1.5 flex-wrap pb-1">
        <span className="text-xs text-content-muted">Available placeholders:</span>
        {PLACEHOLDERS.map((p) => (
          <button
            key={p.token}
            type="button"
            title={p.hint}
            onClick={() => {
              const input = document.getElementById('url-page') as HTMLInputElement | null
              if (input) {
                const start = input.selectionStart ?? input.value.length
                const end = input.selectionEnd ?? input.value.length
                const next = input.value.slice(0, start) + p.token + input.value.slice(end)
                patch({ urlPage: next })
                requestAnimationFrame(() => {
                  input.focus()
                  const pos = start + p.token.length
                  input.setSelectionRange(pos, pos)
                })
              } else {
                patch({ urlPage: form.urlPage + p.token })
              }
            }}
            className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-surface-tertiary border border-border-main text-content-secondary hover:text-content hover:border-border-strong transition-colors cursor-pointer"
          >
            {p.token}
          </button>
        ))}
      </div>
      <FormField label="Page URL template" required help="Used for page 2+ (and page 1 unless firstPage is set)">
        <TextInput
          id="url-page"
          value={form.urlPage}
          onChange={(v) => patch({ urlPage: v })}
          placeholder="/{genreId}/page/{page}/"
        />
      </FormField>
      <FormField label="First page URL (optional)" help="If different from the page template (e.g. /{genreId}/)">
        <TextInput value={form.urlFirstPage} onChange={(v) => patch({ urlFirstPage: v })} placeholder="/{genreId}/" />
      </FormField>
      <FormField label="Search URL (optional)" help="Used for client-side detection or full-text search">
        <TextInput value={form.urlSearch} onChange={(v) => patch({ urlSearch: v })} placeholder="/search?q={query}" />
      </FormField>
      <p className="text-xs text-content-muted">
        If a template starts with «/» it is resolved against the base URL. Templates without {`{page}`}/{`{offset}`}{' '}
        are treated as a single fixed URL.
      </p>
      {form.baseUrl && (form.urlPage || form.urlFirstPage) && (
        <div className="rounded-lg border border-border-main bg-surface-secondary p-3 space-y-1.5 text-xs font-mono">
          <div className="text-[10px] uppercase tracking-wide text-content-muted font-sans">
            Live preview
          </div>
          <div className="text-content-secondary break-words">
            <span className="text-content-muted font-sans">Page 1: </span>
            {resolveUrl(
              form.urlFirstPage || form.urlPage,
              form.baseUrl,
              {
                genreId: form.genreItems[0]?.id || 'all',
                path: form.genreItems[0]?.path || '',
                query: form.genreItems[0]?.query || 'rock',
                page: '1',
                offset: String(Number(form.pageSize) || 20),
                pageSize: form.pageSize || '20',
              },
            )}
          </div>
          <div className="text-content-secondary break-words">
            <span className="text-content-muted font-sans">Page 2: </span>
            {resolveUrl(
              form.urlPage,
              form.baseUrl,
              {
                genreId: form.genreItems[0]?.id || 'all',
                path: form.genreItems[0]?.path || '',
                query: form.genreItems[0]?.query || 'rock',
                page: '2',
                offset: String(Number(form.pageSize) || 20),
                pageSize: form.pageSize || '20',
              },
            )}
          </div>
        </div>
      )}
    </div>
  )
}
