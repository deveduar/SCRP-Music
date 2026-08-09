import { FormField, TextInput, Select, SectionTitle, Toggle } from '../forms/FormControls'
import { FIELD_LABELS, FIELD_HELP, strategyOptions, strategyMeta } from '../../services/adapter-field-meta'
import { FIELD_KEYS } from '../../services/adapter-form'
import type { AdapterFormState, FieldKey, FormFieldMapping } from '../../services/adapter-form'
import type { ParamMeta } from '../../services/adapter-field-meta'

function ParamInput({
  meta,
  value,
  onChange,
}: {
  meta: ParamMeta
  value: string
  onChange: (v: string) => void
}) {
  if (meta.type === 'select') {
    return (
      <Select
        value={value || (meta.options?.[0]?.value ?? '')}
        onChange={onChange}
        options={meta.options ?? []}
      />
    )
  }
  if (meta.type === 'number') {
    return (
      <TextInput value={value} onChange={onChange} placeholder={meta.placeholder} type="number" />
    )
  }
  return <TextInput value={value} onChange={onChange} placeholder={meta.placeholder} />
}

function FieldRow({
  fieldKey,
  field,
  onChange,
}: {
  fieldKey: FieldKey
  field: FormFieldMapping
  onChange: (patch: Partial<FormFieldMapping>) => void
}) {
  const meta = strategyMeta(fieldKey, field.from)
  return (
    <div
      className={`rounded-lg border p-3 ${
        field.enabled ? 'border-accent/30 bg-surface-secondary' : 'border-border-main bg-surface-secondary/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <Toggle
          checked={field.enabled}
          onChange={(v) => onChange({ enabled: v, ...(v && !field.from ? { from: strategyOptions(fieldKey)[0]?.value ?? '' } : {}) })}
          label={FIELD_LABELS[fieldKey]}
          help={FIELD_HELP[fieldKey]}
        />
      </div>
      {field.enabled && (
        <div className="mt-2 pl-0.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Strategy">
              <Select
                value={field.from}
                onChange={(v) => onChange({ from: v })}
                options={strategyOptions(fieldKey)}
              />
            </FormField>
          </div>
          {meta && meta.help && <p className="text-xs text-content-muted mt-1">{meta.help}</p>}
          {meta && meta.params.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 mt-2">
              {meta.params.map((p) => (
                <ParamInput key={p.key} meta={p} value={String(field[p.key])} onChange={(v) => onChange({ [p.key]: v } as Partial<FormFieldMapping>)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function StepFields({
  form,
  patch,
}: {
  form: AdapterFormState
  patch: (p: Partial<AdapterFormState>) => void
}) {
  const setField = (key: FieldKey, p: Partial<FormFieldMapping>) =>
    patch({ fields: { ...form.fields, [key]: { ...form.fields[key], ...p } } })

  return (
    <div className="space-y-4">
      <SectionTitle hint="Map each release field to a source. Only enable the fields your source provides — the rest are skipped.">
        Field mapping
      </SectionTitle>
      <div className="space-y-2">
        {FIELD_KEYS.map((key) => (
          <FieldRow key={key} fieldKey={key} field={form.fields[key]} onChange={(p) => setField(key, p)} />
        ))}
      </div>

      {/* Downloads */}
      <div className="border-t border-border-main pt-3 space-y-3">
        <SectionTitle
          hint={
            form.kind === 'html'
              ? 'Downloads are configured in the HTML Layout step (detail page → downloads).'
              : 'Build the download URL from API fields.'
          }
        >
          Downloads
        </SectionTitle>
        {form.kind === 'api' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="URL template" required help="Uses item fields, e.g. {audio_url} or {baseUrl}/download/{identifier}">
              <TextInput value={form.dlUrlTemplate} onChange={(v) => patch({ dlUrlTemplate: v })} placeholder="{audio_url}" />
            </FormField>
            <FormField label="Host name" help="Shown in the download list">
              <TextInput value={form.dlHostStaticApi} onChange={(v) => patch({ dlHostStaticApi: v })} placeholder="My API" />
            </FormField>
          </div>
        ) : (
          <p className="text-xs text-content-muted">
            Go to the «HTML Layout» step to configure the container and link selectors for download links.
          </p>
        )}
      </div>

      {/* Hardcoded */}
      <div className="border-t border-border-main pt-3 space-y-3">
        <SectionTitle hint="Fixed values applied to every release of this source. This is different from the per-field «Fixed value» strategy above, which targets a single field.">
          Hardcoded values
        </SectionTitle>
        <p className="text-xs text-content-muted -mt-1">
          These override the mapped fields on every release. Use them for sources where a value never
          changes (e.g. one artist, one label). Prefer the per-field «Fixed value» strategy when only a
          single field needs a constant.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Artists (comma separated)">
            <TextInput value={form.hardcodedArtists} onChange={(v) => patch({ hardcodedArtists: v })} placeholder="Kevin MacLeod" />
          </FormField>
          <FormField label="Album">
            <TextInput value={form.hardcodedAlbum} onChange={(v) => patch({ hardcodedAlbum: v })} placeholder="Royalty-Free Music" />
          </FormField>
          <FormField label="Label">
            <TextInput value={form.hardcodedLabel} onChange={(v) => patch({ hardcodedLabel: v })} placeholder="Incompetech" />
          </FormField>
          <FormField label="Catalog">
            <TextInput value={form.hardcodedCatalog} onChange={(v) => patch({ hardcodedCatalog: v })} />
          </FormField>
          <FormField label="Cover URL (fixed)">
            <TextInput value={form.hardcodedCoverUrl} onChange={(v) => patch({ hardcodedCoverUrl: v })} placeholder="https://…" />
          </FormField>
          <FormField label="Genre (fixed)">
            <TextInput value={form.hardcodedGenre} onChange={(v) => patch({ hardcodedGenre: v })} />
          </FormField>
          <FormField label="Source tag" help="Internal tag stored on every release (defaults to the adapter id)">
            <TextInput value={form.hardcodedSource} onChange={(v) => patch({ hardcodedSource: v })} placeholder={form.id} />
          </FormField>
        </div>
      </div>
    </div>
  )
}
