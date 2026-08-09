import { FormField, TextInput, Toggle, SectionTitle, SmallButton } from '../forms/FormControls'
import type { AdapterFormState, FormErrorTranslation } from '../../services/adapter-form'

function SelectorInputs({
  selector,
  attribute,
  onSelector,
  onAttribute,
  attributePlaceholder = 'textContent, href, src…',
}: {
  selector: string
  attribute: string
  onSelector: (v: string) => void
  onAttribute: (v: string) => void
  attributePlaceholder?: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
      <FormField label="CSS selector" required>
        <TextInput value={selector} onChange={onSelector} placeholder="e.g. .item a.title" />
      </FormField>
      <FormField label="Attribute" help="textContent reads the text">
        <TextInput value={attribute} onChange={onAttribute} placeholder={attributePlaceholder} />
      </FormField>
    </div>
  )
}

function DownloadsEditor({
  form,
  patch,
}: {
  form: AdapterFormState
  patch: (p: Partial<AdapterFormState>) => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Container selector" required help="Element holding the download links">
          <TextInput value={form.dlContainer} onChange={(v) => patch({ dlContainer: v })} placeholder="div.quote" />
        </FormField>
        <FormField label="Link selector" required>
          <TextInput value={form.dlLinkSelector} onChange={(v) => patch({ dlLinkSelector: v })} placeholder="a[href]" />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Host from" help="Attribute with the host name (or textContent)">
          <TextInput value={form.dlHostAttr} onChange={(v) => patch({ dlHostAttr: v })} placeholder="textContent" />
        </FormField>
        <FormField label="Fixed host (optional)" help="If all links belong to the same host">
          <TextInput value={form.dlHostStatic} onChange={(v) => patch({ dlHostStatic: v })} placeholder="Example.com" />
        </FormField>
        <FormField label="URL attribute">
          <TextInput value={form.dlUrlAttr} onChange={(v) => patch({ dlUrlAttr: v })} placeholder="href" />
        </FormField>
      </div>
    </div>
  )
}

export function StepStructure({
  form,
  patch,
}: {
  form: AdapterFormState
  patch: (p: Partial<AdapterFormState>) => void
}) {
  if (form.kind === 'api') {
    const setTranslations = (t: FormErrorTranslation[]) => patch({ errorTranslations: t })
    return (
      <div className="space-y-4">
        <SectionTitle hint="How the JSON response is read, status checked and keys resolved.">
          API options
        </SectionTitle>
        <FormField
          label="Results path"
          help="JSON path to the array of items. Leave empty when the response IS the array (e.g. JSONPlaceholder)."
        >
          <TextInput
            value={form.resultsPath}
            onChange={(v) => patch({ resultsPath: v })}
            placeholder="results, response.docs… (empty = array at the root)"
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Status field (optional)" help="Field holding the API status">
            <TextInput value={form.statusFieldPath} onChange={(v) => patch({ statusFieldPath: v })} placeholder="headers.status" />
          </FormField>
          <FormField label="Success value (optional)" help="Value that means success">
            <TextInput value={form.statusSuccessValue} onChange={(v) => patch({ statusSuccessValue: v })} placeholder="success" />
          </FormField>
        </div>
        <FormField label="Error message field (optional)" help="Field with the error message when status is not success">
          <TextInput value={form.errorMessagePath} onChange={(v) => patch({ errorMessagePath: v })} placeholder="headers.error_message" />
        </FormField>

        <div className="border-t border-border-main pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-content">Error translations</span>
            <SmallButton tone="accent" onClick={() => setTranslations([...form.errorTranslations, { pattern: '', message: '' }])}>
              + Add
            </SmallButton>
          </div>
          {form.errorTranslations.length === 0 && (
            <p className="text-xs text-content-muted">No translations. Raw API errors are shown as-is.</p>
          )}
          <div className="space-y-2">
            {form.errorTranslations.map((t, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <TextInput
                  value={t.pattern}
                  onChange={(v) => setTranslations(form.errorTranslations.map((x, j) => (j === i ? { ...x, pattern: v } : x)))}
                  placeholder="regex pattern"
                  className="flex-1 min-w-40 font-mono"
                />
                <TextInput
                  value={t.message}
                  onChange={(v) => setTranslations(form.errorTranslations.map((x, j) => (j === i ? { ...x, message: v } : x)))}
                  placeholder="friendly message"
                  className="flex-1 min-w-40"
                />
                <SmallButton tone="red" onClick={() => setTranslations(form.errorTranslations.filter((_, j) => j !== i))}>
                  Remove
                </SmallButton>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border-main pt-3 space-y-3">
          <Toggle
            checked={form.apiKeyRequired}
            onChange={(v) => patch({ apiKeyRequired: v })}
            label="Requires API key"
            help="Key is stored in Settings → API Keys"
          />
          {form.apiKeyRequired && (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="API key field" required help="Name used in Settings → API Keys">
                <TextInput value={form.apiKeyField} onChange={(v) => patch({ apiKeyField: v })} placeholder="jamendo" />
              </FormField>
              <FormField label="Query param name" required help="How the key is sent, e.g. client_id">
                <TextInput value={form.apiKeyParamName} onChange={(v) => patch({ apiKeyParamName: v })} placeholder="client_id" />
              </FormField>
            </div>
          )}
        </div>

        {form.paginationDetection === 'client-side' && (
          <FormField
            label="Client-side items path (optional)"
            help="JSON path to the full array when pagination is client-side"
          >
            <TextInput
              value={form.clientSidePaginationField}
              onChange={(v) => patch({ clientSidePaginationField: v })}
              placeholder="items"
            />
          </FormField>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionTitle hint="Where each release appears in the HTML and how to extract its data.">
        HTML layout
      </SectionTitle>
      <Toggle
        checked={form.scrapeMode === 'two-phase'}
        onChange={(v) => patch({ scrapeMode: v ? 'two-phase' : 'single-pass' })}
        label="Fetch the detail page"
        help="Two-phase scrapes each release page for covers/downloads. Single-pass only uses the list page."
      />
      <div className="border-t border-border-main pt-3">
        <SectionTitle hint="Element that repeats once per release on the list page.">List page</SectionTitle>
        <FormField label="Release container" required help="CSS selector for a single release block">
          <TextInput
            value={form.releaseContainer}
            onChange={(v) => patch({ releaseContainer: v })}
            placeholder="div[style*=&quot;font-size:9px&quot;]"
          />
        </FormField>
        <div className="space-y-3">
          <SelectorInputs
            selector={form.listTitleSelector}
            attribute={form.listTitleAttribute}
            onSelector={(v) => patch({ listTitleSelector: v })}
            onAttribute={(v) => patch({ listTitleAttribute: v })}
            attributePlaceholder="textContent"
          />
          <SelectorInputs
            selector={form.listUrlSelector}
            attribute={form.listUrlAttribute}
            onSelector={(v) => patch({ listUrlSelector: v })}
            onAttribute={(v) => patch({ listUrlAttribute: v })}
            attributePlaceholder="href"
          />
          <FormField label="Next page selector (optional)" help="Selector to the next-page link for pagination detection">
            <TextInput
              value={form.nextPageSelector}
              onChange={(v) => patch({ nextPageSelector: v })}
              placeholder="a.next"
            />
          </FormField>
        </div>
      </div>

      {form.scrapeMode === 'two-phase' && (
        <div className="border-t border-border-main pt-3 space-y-3">
          <SectionTitle hint="Optional data extracted from each release page.">Detail page</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <FormField label="Cover selector" help="Element holding the cover image">
              <TextInput
                value={form.detailCoverSelector}
                onChange={(v) => patch({ detailCoverSelector: v })}
                placeholder="article img:not([src^=&quot;data:&quot;])"
              />
            </FormField>
            <FormField label="Cover attribute">
              <TextInput value={form.detailCoverAttribute} onChange={(v) => patch({ detailCoverAttribute: v })} placeholder="src" />
            </FormField>
          </div>
          <div className="pt-2">
            <SectionTitle hint="Download links inside the detail page.">Downloads</SectionTitle>
            <DownloadsEditor form={form} patch={patch} />
          </div>
        </div>
      )}
    </div>
  )
}
