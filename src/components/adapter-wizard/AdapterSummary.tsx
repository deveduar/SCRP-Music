import { Braces, Globe, Layers, ListMusic, Repeat, UploadCloud, Tag, KeyRound } from 'lucide-react'
import type { AdapterDefinition } from '../../types/adapter-definition'
import { FIELD_LABELS } from '../../services/adapter-field-meta'
import type { FieldKey } from '../../services/adapter-form'

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1.5 py-0.5 rounded-full bg-surface-tertiary border border-border-main text-content-secondary text-[11px]">
      {children}
    </span>
  )
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-content-muted shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <span className="text-content-muted">{label}: </span>
        <span className="text-content-secondary break-words">{children}</span>
      </div>
    </div>
  )
}

export function AdapterSummary({ def }: { def: AdapterDefinition }) {
  const fieldKeys = Object.keys(def.fieldMapping ?? {}) as FieldKey[]
  const fields = fieldKeys.filter((k) => FIELD_LABELS[k])
  const genres = def.genres.source === 'hardcoded' ? (def.genres.items ?? []) : []
  const genreLabels = genres.map((g) => g.label).filter(Boolean)
  const dlConfig = def.fieldMapping.downloads

  const detectionLabels: Record<string, string> = {
    'api-count': 'API total count',
    'html-last-page': 'Last page in HTML',
    'binary-search': 'Binary search',
    'client-side': 'Client-side',
  }
  const modeLabels: Record<string, string> = {
    'page-number': 'Page number',
    offset: 'Offset',
    'client-side': 'Client-side',
  }
  const transportLabels: Record<string, string> = {
    relay: 'Relay',
    proxy: 'CORS proxy',
    direct: 'Direct',
  }

  return (
    <div className="rounded-lg border border-border-main bg-surface-secondary p-3 space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <Braces size={14} className="text-content-muted" />
        <span className="font-medium text-content-secondary">Adapter overview</span>
        <span
          className={`ml-auto text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border shrink-0 ${
            def.kind === 'api'
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}
        >
          {def.kind === 'api' ? 'JSON API' : 'HTML'}
        </span>
      </div>

      <Row icon={<Globe size={12} />} label="Base URL">
        {def.baseUrl || '—'}
      </Row>

      <Row icon={<UploadCloud size={12} />} label="Transport">
        {transportLabels[def.fetch.mode] ?? def.fetch.mode}
        {def.fetch.relayBase ? ` (${def.fetch.relayBase})` : ''}
        {def.fetch.headers && Object.keys(def.fetch.headers).length > 0
          ? ` · ${Object.keys(def.fetch.headers).length} header(s)`
          : ''}
      </Row>

      <Row icon={<ListMusic size={12} />} label="Genres">
        {def.genres.source === 'dynamic' ? (
          <>
            Dynamic from URL <span className="text-content-muted">(regex)</span>
            {def.genres.fallbackItems && def.genres.fallbackItems.length > 0 && (
              <span className="text-content-muted"> · {def.genres.fallbackItems.length} fallback</span>
            )}
          </>
        ) : genreLabels.length > 0 ? (
          <span className="inline-flex flex-wrap gap-1">
            {genreLabels.slice(0, 6).map((g) => (
              <Chip key={g}>{g}</Chip>
            ))}
            {genreLabels.length > 6 && (
              <span className="text-content-muted">+{genreLabels.length - 6} more</span>
            )}
          </span>
        ) : (
          '—'
        )}
      </Row>

      <Row icon={<Repeat size={12} />} label="Pagination">
        {detectionLabels[def.pagination.detection] ?? def.pagination.detection}
        {' · '}
        {modeLabels[def.pagination.mode] ?? def.pagination.mode}
        {def.pagination.pageSize ? ` · ${def.pagination.pageSize}/page` : ''}
        {def.pagination.maxPagesCap !== undefined && def.pagination.maxPagesCap !== 5000
          ? ` · max ${def.pagination.maxPagesCap}`
          : ''}
        {def.pagination.detection === 'api-count' && def.pagination.countFieldPath
          ? ` · count: ${def.pagination.countFieldPath}`
          : ''}
        {def.pagination.detection === 'html-last-page' && def.pagination.lastPageRegex
          ? ` · regex: ${def.pagination.lastPageRegex}`
          : ''}
      </Row>

      <Row icon={<Layers size={12} />} label="Scrape">
        {def.scrapeMode === 'two-phase' ? 'Fetch detail page (two-phase)' : 'Single-pass (list only)'}
        {def.supportsFastSkipExisting ? ' · fast-skip' : ''}
      </Row>

      <Row icon={<Tag size={12} />} label="Fields">
        <span className="inline-flex flex-wrap gap-1">
          {fields.map((k) => (
            <Chip key={k}>{FIELD_LABELS[k]}</Chip>
          ))}
          {dlConfig && <Chip>Downloads</Chip>}
          {fields.length === 0 && !dlConfig && '—'}
        </span>
      </Row>

      {dlConfig?.urlTemplate && (
        <Row icon={<UploadCloud size={12} />} label="Downloads">
          {dlConfig.hostStatic ? `${dlConfig.hostStatic} · ` : ''}
          <span className="font-mono text-[11px]">{dlConfig.urlTemplate}</span>
        </Row>
      )}

      {def.api?.apiKeyRequired && (
        <Row icon={<KeyRound size={12} />} label="API key">
          {def.api.apiKeyField}
          {def.api.apiKeyParamName ? ` (param: ${def.api.apiKeyParamName})` : ''}
        </Row>
      )}
    </div>
  )
}
