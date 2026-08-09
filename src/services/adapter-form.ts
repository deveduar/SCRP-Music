import type { AdapterDefinition, FieldExtractor, SelectorConfig } from '../types/adapter-definition'
import type { Genre } from '../types/scraper'

export type FieldKey =
  | 'id'
  | 'title'
  | 'artists'
  | 'album'
  | 'year'
  | 'genre'
  | 'label'
  | 'catalog'
  | 'subgenres'
  | 'coverUrl'
  | 'urlRelease'
  | 'stableIdentity'

export const FIELD_KEYS: FieldKey[] = [
  'id',
  'title',
  'artists',
  'album',
  'year',
  'genre',
  'label',
  'catalog',
  'subgenres',
  'coverUrl',
  'urlRelease',
  'stableIdentity',
]

export interface FormHeaderRow {
  key: string
  value: string
}

export interface FormGenreRow {
  id: string
  label: string
  path: string
  query: string
}

export interface FormErrorTranslation {
  pattern: string
  message: string
}

export interface FormFieldMapping {
  enabled: boolean
  from: string
  selector: string
  attribute: string
  pattern: string
  group: string
  source: string
  compositeFields: string
  separator: string
  artistSplit: string
  stripTags: string
  transform: string
  field: string
  value: string
  template: string
  fields: string
  start: string
  end: string
  delimiters: string
}

export interface AdapterFormState {
  name: string
  id: string
  description: string
  kind: 'html' | 'api'
  baseUrl: string
  supportsFastSkipExisting: boolean

  fetchMode: 'relay' | 'proxy' | 'direct'
  relayBase: string
  fetchTimeout: string
  fetchHeaders: FormHeaderRow[]

  genreSource: 'hardcoded' | 'dynamic'
  genreItems: FormGenreRow[]
  dynamicUrl: string
  dynamicRegex: string

  paginationDetection: string
  paginationMode: string
  pageSize: string
  maxPagesCap: string
  lastPageRegex: string
  countFieldPath: string

  scrapeMode: 'single-pass' | 'two-phase'

  resultsPath: string
  statusFieldPath: string
  statusSuccessValue: string
  errorMessagePath: string
  apiKeyRequired: boolean
  apiKeyField: string
  apiKeyParamName: string
  errorTranslations: FormErrorTranslation[]
  clientSidePaginationField: string

  releaseContainer: string
  listTitleSelector: string
  listTitleAttribute: string
  listUrlSelector: string
  listUrlAttribute: string
  nextPageSelector: string
  detailCoverSelector: string
  detailCoverAttribute: string
  dlContainer: string
  dlLinkSelector: string
  dlHostAttr: string
  dlHostStatic: string
  dlUrlAttr: string

  urlPage: string
  urlFirstPage: string
  urlSearch: string

  fields: Record<FieldKey, FormFieldMapping>

  dlUrlTemplate: string
  dlHostStaticApi: string

  hardcodedArtists: string
  hardcodedAlbum: string
  hardcodedLabel: string
  hardcodedCatalog: string
  hardcodedCoverUrl: string
  hardcodedGenre: string
  hardcodedSource: string
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function emptyFieldMapping(): FormFieldMapping {
  return {
    enabled: false,
    from: '',
    selector: '',
    attribute: '',
    pattern: '',
    group: '',
    source: 'urlRelease',
    compositeFields: '',
    separator: ' - ',
    artistSplit: '',
    stripTags: '',
    transform: 'capitalize',
    field: '',
    value: '',
    template: '',
    fields: '',
    start: '',
    end: '',
    delimiters: '',
  }
}

export function emptyForm(): AdapterFormState {
  const fields = {} as Record<FieldKey, FormFieldMapping>
  for (const key of FIELD_KEYS) {
    fields[key] = emptyFieldMapping()
  }
  return {
    name: '',
    id: '',
    description: '',
    kind: 'html',
    baseUrl: '',
    supportsFastSkipExisting: true,
    fetchMode: 'relay',
    relayBase: '/api/relay',
    fetchTimeout: '30000',
    fetchHeaders: [],
    genreSource: 'hardcoded',
    genreItems: [{ id: 'all', label: 'All genres', path: '', query: '' }],
    dynamicUrl: '',
    dynamicRegex: '',
    paginationDetection: 'html-last-page',
    paginationMode: 'page-number',
    pageSize: '20',
    maxPagesCap: '5000',
    lastPageRegex: '',
    countFieldPath: '',
    scrapeMode: 'two-phase',
    resultsPath: '',
    statusFieldPath: '',
    statusSuccessValue: '',
    errorMessagePath: '',
    apiKeyRequired: false,
    apiKeyField: '',
    apiKeyParamName: '',
    errorTranslations: [],
    clientSidePaginationField: '',
    releaseContainer: '',
    listTitleSelector: '',
    listTitleAttribute: 'textContent',
    listUrlSelector: '',
    listUrlAttribute: 'href',
    nextPageSelector: '',
    detailCoverSelector: '',
    detailCoverAttribute: 'src',
    dlContainer: '',
    dlLinkSelector: '',
    dlHostAttr: 'textContent',
    dlHostStatic: '',
    dlUrlAttr: 'href',
    urlPage: '',
    urlFirstPage: '',
    urlSearch: '',
    fields,
    dlUrlTemplate: '',
    dlHostStaticApi: '',
    hardcodedArtists: '',
    hardcodedAlbum: '',
    hardcodedLabel: '',
    hardcodedCatalog: '',
    hardcodedCoverUrl: '',
    hardcodedGenre: '',
    hardcodedSource: '',
  }
}

function genreRows(items: Genre[] | undefined): FormGenreRow[] {
  return (items ?? []).map((g) => ({ id: g.id, label: g.label, path: g.path ?? '', query: g.query ?? '' }))
}

function splitSelectorConfig(config: SelectorConfig | string | undefined): { selector: string; attribute: string } {
  if (!config) return { selector: '', attribute: 'textContent' }
  if (typeof config === 'string') return { selector: config, attribute: 'textContent' }
  return { selector: config.selector || '', attribute: config.attribute || '' }
}

function extractorToForm(ex: FieldExtractor): Partial<FormFieldMapping> {
  const base: Partial<FormFieldMapping> = { from: ex.from }
  switch (ex.from) {
    case 'selector':
      base.selector = ex.selector
      base.attribute = ex.attribute ?? ''
      break
    case 'selectorText':
      base.selector = ex.selector
      break
    case 'regex':
      base.pattern = ex.pattern
      base.group = ex.group !== undefined ? String(ex.group) : ''
      break
    case 'sha1':
      if (ex.source === 'composite') {
        base.from = 'sha1-comp'
        base.source = 'composite'
        base.compositeFields = (ex.compositeFields ?? []).join(',')
      } else if (ex.source === 'identifier') {
        base.from = 'sha1-id'
        base.source = ex.compositeFields?.[0] ?? 'identifier'
      } else {
        base.from = 'sha1-url'
        base.source = 'urlRelease'
      }
      break
    case 'titleParse':
      base.separator = ex.separator
      base.artistSplit = ex.artistSplit ?? ''
      base.stripTags = ex.stripTags ?? ''
      break
    case 'urlPath':
      base.pattern = ex.pattern
      base.transform = ex.transform ?? 'capitalize'
      break
    case 'apiField':
      base.field = ex.field
      break
    case 'hardcoded':
      base.value = ex.value
      break
    case 'concat':
      base.template = ex.template
      base.fields = ex.fields.join(',')
      break
    case 'substr':
      base.source = ex.source
      base.start = String(ex.start)
      base.end = ex.end !== undefined ? String(ex.end) : ''
      break
    case 'split':
      base.fields = ex.fields.join(',')
      base.delimiters = ex.delimiters ?? ''
      break
  }
  return base
}

export function definitionToForm(def: AdapterDefinition): AdapterFormState {
  const form = emptyForm()
  form.name = def.name
  form.id = def.id
  form.description = def.description ?? ''
  form.kind = def.kind
  form.baseUrl = def.baseUrl
  form.supportsFastSkipExisting = def.supportsFastSkipExisting === true

  form.fetchMode = def.fetch.mode
  form.relayBase = def.fetch.relayBase ?? '/api/relay'
  form.fetchTimeout = def.fetch.timeout !== undefined ? String(def.fetch.timeout) : '30000'
  form.fetchHeaders = Object.entries(def.fetch.headers ?? {}).map(([key, value]) => ({ key, value }))

  form.genreSource = def.genres.source
  form.genreItems = def.genres.source === 'hardcoded'
    ? genreRows(def.genres.items)
    : genreRows(def.genres.fallbackItems)
  form.dynamicUrl = def.genres.dynamicUrl ?? ''
  form.dynamicRegex = def.genres.dynamicRegex ?? ''

  form.paginationDetection = def.pagination.detection
  form.paginationMode = def.pagination.mode
  form.pageSize = String(def.pagination.pageSize ?? 20)
  form.maxPagesCap = def.pagination.maxPagesCap !== undefined ? String(def.pagination.maxPagesCap) : ''
  form.lastPageRegex = def.pagination.lastPageRegex ?? ''
  form.countFieldPath = def.api?.countFieldPath ?? def.pagination.countFieldPath ?? ''

  form.scrapeMode = def.scrapeMode

  form.resultsPath = def.api?.resultsPath ?? ''
  form.statusFieldPath = def.api?.statusFieldPath ?? ''
  form.statusSuccessValue = def.api?.statusSuccessValue ?? ''
  form.errorMessagePath = def.api?.errorMessagePath ?? ''
  form.apiKeyRequired = def.api?.apiKeyRequired === true
  form.apiKeyField = def.api?.apiKeyField ?? ''
  form.apiKeyParamName = def.api?.apiKeyParamName ?? ''
  form.errorTranslations = (def.api?.errorTranslations ?? []).map((t) => ({ pattern: t.pattern, message: t.message }))
  form.clientSidePaginationField = def.api?.clientSidePaginationField ?? ''

  const listPage = def.selectors?.listPage
  form.releaseContainer = listPage?.releaseContainer ?? ''
  const listTitle = splitSelectorConfig(listPage?.title)
  form.listTitleSelector = listTitle.selector
  form.listTitleAttribute = listTitle.attribute
  const listUrl = splitSelectorConfig(listPage?.urlRelease)
  form.listUrlSelector = listUrl.selector
  form.listUrlAttribute = listUrl.attribute
  form.nextPageSelector = listPage?.nextPage ?? ''

  const detail = def.selectors?.detailPage
  if (detail) {
    const cover = splitSelectorConfig(detail.cover)
    form.detailCoverSelector = cover.selector
    form.detailCoverAttribute = cover.attribute
    form.dlContainer = detail.downloads?.container ?? ''
    form.dlLinkSelector = detail.downloads?.linkSelector ?? ''
    form.dlHostAttr = detail.downloads?.hostAttr ?? 'textContent'
    form.dlHostStatic = detail.downloads?.hostStatic ?? ''
    form.dlUrlAttr = detail.downloads?.urlAttr ?? 'href'
  }

  form.urlPage = def.urlTemplates.page ?? ''
  form.urlFirstPage = def.urlTemplates.firstPage ?? ''
  form.urlSearch = def.urlTemplates.search ?? ''

  for (const key of FIELD_KEYS) {
    const ex = def.fieldMapping[key]
    if (ex) {
      form.fields[key] = {
        ...emptyFieldMapping(),
        enabled: true,
        ...extractorToForm(ex),
      }
    }
  }

  form.dlUrlTemplate = def.fieldMapping.downloads?.urlTemplate ?? ''
  form.dlHostStaticApi = def.fieldMapping.downloads?.hostStatic ?? ''

  form.hardcodedArtists = (def.hardcodedFields?.artists ?? []).join(',')
  form.hardcodedAlbum = def.hardcodedFields?.album ?? ''
  form.hardcodedLabel = def.hardcodedFields?.label ?? ''
  form.hardcodedCatalog = def.hardcodedFields?.catalog ?? ''
  form.hardcodedCoverUrl = def.hardcodedFields?.coverUrl ?? ''
  form.hardcodedGenre = def.hardcodedFields?.genre ?? ''
  form.hardcodedSource = def.hardcodedFields?.source ?? ''

  return form
}

function buildSelectorConfig(selector: string, attribute: string): SelectorConfig | string {
  if (attribute && attribute !== 'textContent' && attribute !== '') {
    return { selector, attribute }
  }
  return selector
}

function extractorFromForm(f: FormFieldMapping): FieldExtractor | null {
  switch (f.from) {
    case 'selector':
      return f.selector ? { from: 'selector', selector: f.selector, ...(f.attribute ? { attribute: f.attribute } : {}) } : null
    case 'selectorText':
      return f.selector ? { from: 'selectorText', selector: f.selector } : null
    case 'regex': {
      if (!f.pattern) return null
      return { from: 'regex', pattern: f.pattern, ...(f.group ? { group: Number(f.group) } : {}) }
    }
    case 'sha1':
    case 'sha1-url':
    case 'sha1-id':
    case 'sha1-comp': {
      if (f.from === 'sha1-url') {
        return { from: 'sha1', source: 'urlRelease' }
      }
      if (f.from === 'sha1-id') {
        const src = f.source?.trim() || 'identifier'
        return { from: 'sha1', source: 'identifier', compositeFields: [src] }
      }
      const fields = f.compositeFields.split(',').map((s) => s.trim()).filter(Boolean)
      if (fields.length === 0) return null
      return { from: 'sha1', source: 'composite', compositeFields: fields }
    }
    case 'titleParse':
      return f.separator
        ? { from: 'titleParse', separator: f.separator, ...(f.artistSplit ? { artistSplit: f.artistSplit } : {}), ...(f.stripTags ? { stripTags: f.stripTags } : {}) }
        : null
    case 'urlPath':
      return f.pattern
        ? { from: 'urlPath', pattern: f.pattern, ...(f.transform ? { transform: f.transform as 'capitalize' | 'none' } : {}) }
        : null
    case 'apiField':
      return f.field ? { from: 'apiField', field: f.field } : null
    case 'hardcoded':
      return { from: 'hardcoded', value: f.value }
    case 'concat': {
      const fields = f.fields.split(',').map((s) => s.trim()).filter(Boolean)
      return f.template && fields.length > 0 ? { from: 'concat', template: f.template, fields } : null
    }
    case 'substr': {
      if (!f.source || f.start === '') return null
      return { from: 'substr', source: f.source, start: Number(f.start), ...(f.end !== '' ? { end: Number(f.end) } : {}) }
    }
    case 'split': {
      const fields = f.fields.split(',').map((s) => s.trim()).filter(Boolean)
      if (fields.length === 0) return null
      return { from: 'split', fields, ...(f.delimiters ? { delimiters: f.delimiters } : {}) }
    }
    default:
      return null
  }
}

function buildFieldMapping(state: AdapterFormState): AdapterDefinition['fieldMapping'] {
  const fm: AdapterDefinition['fieldMapping'] = {}
  for (const key of FIELD_KEYS) {
    const f = state.fields[key]
    if (!f.enabled) continue
    const ex = extractorFromForm(f)
    if (ex) fm[key] = ex
  }
  if (state.kind === 'api') {
    const dl: { urlTemplate?: string; hostStatic?: string } = {}
    if (state.dlUrlTemplate) dl.urlTemplate = state.dlUrlTemplate
    if (state.dlHostStaticApi) dl.hostStatic = state.dlHostStaticApi
    if (Object.keys(dl).length > 0) fm.downloads = dl
  }
  return fm
}

function buildHtmlSelectors(state: AdapterFormState): AdapterDefinition['selectors'] {
  if (!state.releaseContainer || !state.listTitleSelector) return undefined
  const listPage: { releaseContainer: string; title: SelectorConfig | string; urlRelease: SelectorConfig | string; nextPage?: string } = {
    releaseContainer: state.releaseContainer,
    title: buildSelectorConfig(state.listTitleSelector, state.listTitleAttribute),
    urlRelease: buildSelectorConfig(state.listUrlSelector || state.listTitleSelector, state.listUrlAttribute || 'href'),
  }
  if (state.nextPageSelector) listPage.nextPage = state.nextPageSelector

  interface DetailPageShape {
    cover?: SelectorConfig | string
    downloads?: { container: string; linkSelector: string; hostAttr?: string; hostStatic?: string; urlAttr?: string }
  }

  const selectors: AdapterDefinition['selectors'] = { listPage }
  if (state.scrapeMode === 'two-phase') {
    const detailPage: DetailPageShape = {}
    if (state.detailCoverSelector) {
      detailPage.cover = buildSelectorConfig(state.detailCoverSelector, state.detailCoverAttribute)
    }
    if (state.dlContainer && state.dlLinkSelector) {
      const downloads: DetailPageShape['downloads'] = {
        container: state.dlContainer,
        linkSelector: state.dlLinkSelector,
      }
      if (state.dlHostAttr) downloads.hostAttr = state.dlHostAttr
      if (state.dlHostStatic) downloads.hostStatic = state.dlHostStatic
      if (state.dlUrlAttr) downloads.urlAttr = state.dlUrlAttr
      detailPage.downloads = downloads
    }
    if (Object.keys(detailPage).length > 0) {
      selectors.detailPage = detailPage
    }
  }
  return selectors
}

export function formToDefinition(state: AdapterFormState): AdapterDefinition {
  const genres: { source: 'hardcoded' | 'dynamic'; items?: Genre[]; dynamicUrl?: string; dynamicRegex?: string; fallbackItems?: Genre[] } = {
    source: state.genreSource,
  }
  const mapGenres = (): Genre[] => state.genreItems
    .filter((g) => g.label.trim())
    .map((g) => ({
      id: g.id || slugify(g.label),
      label: g.label,
      path: g.path,
      ...(g.query ? { query: g.query } : {}),
    }))
  if (state.genreSource === 'hardcoded') {
    genres.items = mapGenres()
  } else {
    if (state.dynamicUrl) genres.dynamicUrl = state.dynamicUrl
    if (state.dynamicRegex) genres.dynamicRegex = state.dynamicRegex
    const fallback = mapGenres()
    if (fallback.length > 0) genres.fallbackItems = fallback
  }

  const pagination: AdapterDefinition['pagination'] = {
    detection: state.paginationDetection as AdapterDefinition['pagination']['detection'],
    mode: state.paginationMode as AdapterDefinition['pagination']['mode'],
    pageSize: Number(state.pageSize) || 20,
  }
  if (state.maxPagesCap) pagination.maxPagesCap = Number(state.maxPagesCap)
  if (state.countFieldPath) pagination.countFieldPath = state.countFieldPath
  if (state.lastPageRegex) pagination.lastPageRegex = state.lastPageRegex

  const api: NonNullable<AdapterDefinition['api']> = {}
  if (state.resultsPath) api.resultsPath = state.resultsPath
  if (state.countFieldPath) api.countFieldPath = state.countFieldPath
  if (state.statusFieldPath) api.statusFieldPath = state.statusFieldPath
  if (state.statusSuccessValue) api.statusSuccessValue = state.statusSuccessValue
  if (state.errorMessagePath) api.errorMessagePath = state.errorMessagePath
  if (state.apiKeyRequired) {
    api.apiKeyRequired = true
    if (state.apiKeyField) api.apiKeyField = state.apiKeyField
    if (state.apiKeyParamName) api.apiKeyParamName = state.apiKeyParamName
  }
  const errorTranslations = state.errorTranslations.filter((t) => t.pattern && t.message)
  if (errorTranslations.length > 0) api.errorTranslations = errorTranslations
  if (state.clientSidePaginationField) api.clientSidePaginationField = state.clientSidePaginationField

  const selectors = state.kind === 'html' ? buildHtmlSelectors(state) : undefined

  const urlTemplates: AdapterDefinition['urlTemplates'] = { page: state.urlPage }
  if (state.urlFirstPage) urlTemplates.firstPage = state.urlFirstPage
  if (state.urlSearch) urlTemplates.search = state.urlSearch

  const hardcoded: NonNullable<AdapterDefinition['hardcodedFields']> = {}
  if (state.hardcodedSource) hardcoded.source = state.hardcodedSource
  const artists = state.hardcodedArtists.split(',').map((s) => s.trim()).filter(Boolean)
  if (artists.length > 0) hardcoded.artists = artists
  if (state.hardcodedAlbum) hardcoded.album = state.hardcodedAlbum
  if (state.hardcodedLabel) hardcoded.label = state.hardcodedLabel
  if (state.hardcodedCatalog) hardcoded.catalog = state.hardcodedCatalog
  if (state.hardcodedCoverUrl) hardcoded.coverUrl = state.hardcodedCoverUrl
  if (state.hardcodedGenre) hardcoded.genre = state.hardcodedGenre

  const fetch: AdapterDefinition['fetch'] = { mode: state.fetchMode }
  if (state.fetchMode === 'relay' && state.relayBase) fetch.relayBase = state.relayBase
  if (state.fetchMode === 'direct') {
    if (state.fetchTimeout) fetch.timeout = Number(state.fetchTimeout) || undefined
    const headers = Object.fromEntries(state.fetchHeaders.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value]))
    if (Object.keys(headers).length > 0) fetch.headers = headers
  }

  const def: AdapterDefinition = {
    version: '1.0',
    id: state.id,
    name: state.name,
    ...(state.description ? { description: state.description } : {}),
    kind: state.kind,
    baseUrl: state.baseUrl,
    ...(state.supportsFastSkipExisting ? { supportsFastSkipExisting: true } : {}),
    fetch,
    genres,
    pagination,
    scrapeMode: state.scrapeMode,
    ...(state.kind === 'api' && Object.keys(api).length > 0 ? { api } : {}),
    ...(selectors ? { selectors } : {}),
    urlTemplates,
    fieldMapping: buildFieldMapping(state),
    ...(Object.keys(hardcoded).length > 0 ? { hardcodedFields: hardcoded } : {}),
  }
  return def
}

export function normalizeForm(value: unknown): AdapterFormState {
  const base = emptyForm()
  if (!value || typeof value !== 'object') return base
  const src = value as Partial<AdapterFormState>
  const merged = { ...base, ...src } as AdapterFormState
  if (!Array.isArray(merged.genreItems)) merged.genreItems = base.genreItems
  if (!Array.isArray(merged.fetchHeaders)) merged.fetchHeaders = []
  if (!Array.isArray(merged.errorTranslations)) merged.errorTranslations = []
  merged.fields = { ...base.fields }
  for (const key of FIELD_KEYS) {
    const f = src.fields?.[key]
    if (f && typeof f === 'object') {
      merged.fields[key] = { ...base.fields[key], ...f }
    }
  }
  return merged
}

export function htmlTemplateForm(): AdapterFormState {
  const form = emptyForm()
  form.name = 'My HTML Source'
  form.id = 'myhtml'
  form.description = 'HTML adapter with two-phase scraping'
  form.kind = 'html'
  form.baseUrl = 'https://example.com'
  form.supportsFastSkipExisting = true
  form.fetchMode = 'relay'
  form.relayBase = '/api/relay'
  form.genreItems = [
    { id: 'trance', label: 'Trance', path: '/trance/', query: '' },
    { id: 'house', label: 'House', path: '/house/', query: '' },
  ]
  form.paginationDetection = 'html-last-page'
  form.paginationMode = 'page-number'
  form.pageSize = '20'
  form.maxPagesCap = '5000'
  form.lastPageRegex = 'page/([0-9]+)/'
  form.scrapeMode = 'two-phase'
  form.releaseContainer = 'div.item'
  form.listTitleSelector = 'a'
  form.listTitleAttribute = 'textContent'
  form.listUrlSelector = 'a'
  form.listUrlAttribute = 'href'
  form.detailCoverSelector = 'article img:not([src^="data:"])'
  form.detailCoverAttribute = 'src'
  form.dlContainer = 'div.quote'
  form.dlLinkSelector = 'a[href]'
  form.dlHostAttr = 'textContent'
  form.dlUrlAttr = 'href'
  form.urlPage = '/{genreId}/page/{page}/'
  form.urlFirstPage = '/{genreId}/'
  form.fields.title = { ...form.fields.title, enabled: true, from: 'titleParse', separator: ' - ', artistSplit: ',' }
  form.fields.artists = { ...form.fields.artists, enabled: true, from: 'titleParse', separator: ' - ', artistSplit: ',' }
  form.fields.album = { ...form.fields.album, enabled: true, from: 'titleParse', separator: ' - ', artistSplit: ',' }
  form.fields.year = { ...form.fields.year, enabled: true, from: 'titleParse', separator: ' - ', artistSplit: ',' }
  form.fields.genre = { ...form.fields.genre, enabled: true, from: 'urlPath', pattern: 'example\\.com\\/([^/]+)', transform: 'capitalize' }
  form.fields.coverUrl = { ...form.fields.coverUrl, enabled: true, from: 'selector', selector: 'article img:not([src^="data:"])', attribute: 'src' }
  form.fields.stableIdentity = { ...form.fields.stableIdentity, enabled: true, from: 'sha1-comp', source: 'composite', compositeFields: 'urlRelease' }
  form.hardcodedSource = 'myhtml'
  return form
}

export function apiTemplateForm(): AdapterFormState {
  const form = emptyForm()
  form.name = 'My API Source'
  form.id = 'myapi'
  form.description = 'JSON API adapter with server-side pagination'
  form.kind = 'api'
  form.baseUrl = 'https://api.example.com'
  form.fetchMode = 'proxy'
  form.fetchTimeout = '30000'
  form.fetchHeaders = [{ key: 'Accept', value: 'application/json' }]
  form.genreItems = [
    { id: 'all', label: 'All genres', path: '', query: '' },
    { id: 'rock', label: 'Rock', path: '', query: 'rock' },
  ]
  form.paginationDetection = 'api-count'
  form.paginationMode = 'page-number'
  form.pageSize = '50'
  form.countFieldPath = 'response.total'
  form.resultsPath = ''
  form.urlPage = '/search?q={query}&page={page}&page_size={pageSize}'
  form.fields.id = { ...form.fields.id, enabled: true, from: 'sha1-id', source: 'identifier' }
  form.fields.title = { ...form.fields.title, enabled: true, from: 'apiField', field: 'title' }
  form.fields.artists = { ...form.fields.artists, enabled: true, from: 'apiField', field: 'artist' }
  form.fields.album = { ...form.fields.album, enabled: true, from: 'apiField', field: 'title' }
  form.fields.year = { ...form.fields.year, enabled: true, from: 'apiField', field: 'year' }
  form.fields.genre = { ...form.fields.genre, enabled: true, from: 'apiField', field: 'genre' }
  form.fields.coverUrl = { ...form.fields.coverUrl, enabled: true, from: 'apiField', field: 'cover' }
  form.fields.urlRelease = { ...form.fields.urlRelease, enabled: true, from: 'concat', template: '{0}/details/{1}', fields: 'baseUrl,identifier' }
  form.dlUrlTemplate = '{audio_url}'
  form.dlHostStaticApi = 'My API'
  form.hardcodedSource = 'myapi'
  return form
}
