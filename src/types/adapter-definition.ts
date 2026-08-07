import type { Genre } from './scraper'

export interface SelectorConfig {
  selector: string
  attribute?: string
  regex?: string
}

export type FieldExtractor =
  | { from: 'selector'; selector: string; attribute?: string }
  | { from: 'selectorText'; selector: string }
  | { from: 'regex'; pattern: string; group?: number }
  | { from: 'sha1'; source: 'urlRelease' | 'identifier' | 'composite'; compositeFields?: string[] }
  | { from: 'titleParse'; separator: string; artistSplit?: string; stripTags?: string }
  | { from: 'urlPath'; pattern: string; transform?: 'capitalize' | 'none' }
  | { from: 'apiField'; field: string }
  | { from: 'hardcoded'; value: string }
  | { from: 'concat'; template: string; fields: string[] }
  | { from: 'substr'; source: string; start: number; end?: number }
  | { from: 'split'; fields: string[]; delimiters?: string }

export interface DownloadsConfig {
  container?: string
  linkSelector?: string
  hostAttr?: string
  hostStatic?: string
  urlAttr?: string
  urlTemplate?: string
}

export interface AdapterDefinition {
  version: '1.0'
  id: string
  name: string
  description?: string
  kind: 'html' | 'api'
  baseUrl: string
  supportsFastSkipExisting?: boolean

  fetch: {
    mode: 'proxy' | 'relay' | 'direct'
    relayBase?: string
    timeout?: number
    headers?: Record<string, string>
  }

  genres: {
    source: 'hardcoded' | 'dynamic'
    items?: Genre[]
    dynamicUrl?: string
    dynamicRegex?: string
    fallbackItems?: Genre[]
  }

  pagination: {
    detection: 'api-count' | 'binary-search' | 'client-side'
    mode: 'page-number' | 'offset' | 'client-side'
    pageSize: number
    maxPagesCap?: number
    countFieldPath?: string
  }

  scrapeMode: 'single-pass' | 'two-phase'

  api?: {
    countUrlTemplate?: string
    resultsPath?: string
    countFieldPath?: string
    statusFieldPath?: string
    statusSuccessValue?: string
    errorMessagePath?: string
    apiKeyRequired?: boolean
    apiKeyField?: string
    apiKeyParamName?: string
    errorTranslations?: Array<{ pattern: string; message: string }>
    clientSidePaginationField?: string
  }

  selectors?: {
    listPage: {
      releaseContainer: string
      title: SelectorConfig | string
      urlRelease: SelectorConfig | string
      nextPage?: string
    }
    detailPage?: {
      cover?: SelectorConfig | string
      downloads?: {
        container: string
        linkSelector: string
        hostAttr?: string
        hostStatic?: string
        urlAttr?: string
      }
    }
  }

  urlTemplates: {
    page: string
    firstPage?: string
    search?: string
  }

  fieldMapping: {
    id?: FieldExtractor
    title?: FieldExtractor
    artists?: FieldExtractor
    album?: FieldExtractor
    label?: FieldExtractor
    catalog?: FieldExtractor
    year?: FieldExtractor
    genre?: FieldExtractor
    subgenres?: FieldExtractor
    coverUrl?: FieldExtractor
    downloads?: DownloadsConfig
    urlRelease?: FieldExtractor
    stableIdentity?: FieldExtractor
  }

  hardcodedFields?: {
    artists?: string[]
    album?: string
    label?: string
    catalog?: string
    coverUrl?: string | null
    genre?: string
    source?: string
  }
}
