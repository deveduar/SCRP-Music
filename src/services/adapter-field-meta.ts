import type { FormFieldMapping, FieldKey } from './adapter-form'

export interface ParamMeta {
  key: keyof FormFieldMapping
  label: string
  help?: string
  type?: 'text' | 'select' | 'number'
  options?: { value: string; label: string }[]
  placeholder?: string
}

export interface ExtractorOption {
  value: string
  label: string
  help: string
  params: ParamMeta[]
}

const selectorParams: ParamMeta[] = [
  { key: 'selector', label: 'CSS selector', placeholder: 'e.g. h1.title' },
  { key: 'attribute', label: 'Attribute', placeholder: 'textContent, href, src, data-id…' },
]

const regexParams: ParamMeta[] = [
  { key: 'pattern', label: 'Regex pattern', placeholder: 'e.g. (\\d{4})' },
  { key: 'group', label: 'Capture group', type: 'number', placeholder: '1' },
]

const sha1Url: ExtractorOption = {
  value: 'sha1-url',
  label: 'Hash of release URL',
  help: 'Stable id from the release URL',
  params: [],
}

const sha1Identifier: ExtractorOption = {
  value: 'sha1-id',
  label: 'Hash of identifier',
  help: 'Hash of a unique field in the item (API). Leave empty to use the default «identifier» value.',
  params: [{ key: 'source', label: 'Source field', placeholder: 'identifier or field path' }],
}

const sha1Composite: ExtractorOption = {
  value: 'sha1-comp',
  label: 'Hash of combined fields',
  help: 'Hash of one or more fields joined together',
  params: [
    { key: 'source', label: 'Source', type: 'select', options: [{ value: 'composite', label: 'composite' }] },
    { key: 'compositeFields', label: 'Fields (comma separated)', placeholder: 'urlRelease,title' },
  ],
}

const titleParse: ExtractorOption = {
  value: 'titleParse',
  label: 'Parse from title',
  help: 'Split "Artist - Album (year)" style titles',
  params: [
    { key: 'separator', label: 'Separator', placeholder: ' - ' },
    { key: 'artistSplit', label: 'Artist split char', placeholder: ',' },
    { key: 'stripTags', label: 'Strip regex (optional)', placeholder: '\\s+(MP3|FLAC)\\s*$' },
  ],
}

const apiField: ExtractorOption = {
  value: 'apiField',
  label: 'API field',
  help: 'Read a field from the JSON item',
  params: [{ key: 'field', label: 'Field path', placeholder: 'item.artist or nested.path' }],
}

const hardcoded: ExtractorOption = {
  value: 'hardcoded',
  label: 'Fixed value',
  help: 'Always use this value',
  params: [{ key: 'value', label: 'Value' }],
}

const urlPath: ExtractorOption = {
  value: 'urlPath',
  label: 'Extract from URL path',
  help: 'Regex over the release URL',
  params: [
    { key: 'pattern', label: 'Regex pattern', placeholder: 'example\\.com\\/([^/]+)' },
    { key: 'transform', label: 'Transform', type: 'select', options: [{ value: 'capitalize', label: 'Capitalize' }, { value: 'none', label: 'None' }] },
  ],
}

const concat: ExtractorOption = {
  value: 'concat',
  label: 'Build from fields',
  help: 'Join values into a URL/template using {0}, {1}…',
  params: [
    { key: 'template', label: 'Template', placeholder: 'https://site.com/list/a{0}' },
    { key: 'fields', label: 'Fields (comma separated)', placeholder: 'baseUrl,identifier' },
  ],
}

const substr: ExtractorOption = {
  value: 'substr',
  label: 'Substring',
  help: 'Slice a field (e.g. year from a date)',
  params: [
    { key: 'source', label: 'Source field', placeholder: 'releasedate' },
    { key: 'start', label: 'Start index', type: 'number', placeholder: '0' },
    { key: 'end', label: 'End index (optional)', type: 'number', placeholder: '4' },
  ],
}

const splitExtractor: ExtractorOption = {
  value: 'split',
  label: 'Split into list',
  help: 'Split one or more fields into multiple values',
  params: [
    { key: 'fields', label: 'Fields (comma separated)', placeholder: 'subject' },
    { key: 'delimiters', label: 'Delimiters (optional)', placeholder: '[,/;]+' },
  ],
}

const selectorExtractor: ExtractorOption = { ...({ value: 'selector', label: 'HTML selector', help: 'Read from an element', params: selectorParams } as ExtractorOption) }
const selectorTextExtractor: ExtractorOption = {
  value: 'selectorText',
  label: 'HTML text',
  help: 'Read the text content of a selector',
  params: [{ key: 'selector', label: 'CSS selector', placeholder: 'e.g. h1.title' }],
}
const regexExtractor: ExtractorOption = {
  value: 'regex',
  label: 'Regex',
  help: 'Extract with a regex',
  params: regexParams,
}

export const FIELD_STRATEGIES: Record<FieldKey, ExtractorOption[]> = {
  id: [sha1Url, sha1Identifier, sha1Composite],
  title: [titleParse, apiField, selectorExtractor, selectorTextExtractor, regexExtractor, hardcoded],
  artists: [titleParse, apiField, selectorExtractor, hardcoded],
  album: [titleParse, apiField, selectorExtractor, hardcoded],
  year: [titleParse, apiField, regexExtractor, substr, hardcoded],
  genre: [urlPath, apiField, hardcoded],
  label: [apiField, selectorExtractor, hardcoded],
  catalog: [apiField, selectorExtractor, regexExtractor, hardcoded],
  subgenres: [splitExtractor, apiField, hardcoded],
  coverUrl: [selectorExtractor, apiField, concat, hardcoded],
  urlRelease: [concat, apiField, selectorExtractor, hardcoded],
  stableIdentity: [sha1Url, sha1Composite],
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  id: 'ID',
  title: 'Title',
  artists: 'Artists',
  album: 'Album',
  year: 'Year',
  genre: 'Genre',
  label: 'Label',
  catalog: 'Catalog',
  subgenres: 'Subgenres',
  coverUrl: 'Cover',
  urlRelease: 'Release URL',
  stableIdentity: 'Stable identity',
}

export const FIELD_HELP: Record<FieldKey, string> = {
  id: 'Unique identifier used to detect duplicates',
  title: 'Release title',
  artists: 'List of artists',
  album: 'Album name',
  year: 'Release year',
  genre: 'Genre label',
  label: 'Record label',
  catalog: 'Catalog number',
  subgenres: 'Sub-genres / tags',
  coverUrl: 'Cover image URL',
  urlRelease: 'URL to the release page',
  stableIdentity: 'Stable key to merge across scrapes',
}

export const EXTRACTOR_LABELS: Record<string, string> = {
  selector: 'HTML selector',
  selectorText: 'HTML text',
  regex: 'Regex',
  sha1: 'Hash',
  titleParse: 'Parse from title',
  urlPath: 'Extract from URL path',
  apiField: 'API field',
  hardcoded: 'Fixed value',
  concat: 'Build from fields',
  substr: 'Substring',
  split: 'Split into list',
}

export function strategyOptions(key: FieldKey): { value: string; label: string }[] {
  return (FIELD_STRATEGIES[key] ?? []).map((o) => ({ value: o.value, label: o.label }))
}

export function strategyMeta(key: FieldKey, from: string): ExtractorOption | undefined {
  return (FIELD_STRATEGIES[key] ?? []).find((o) => o.value === from)
}
