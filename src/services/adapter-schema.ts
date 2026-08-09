import { z } from 'zod'
import type { AdapterDefinition } from '../types/adapter-definition'

export const SelectorConfigSchema = z.object({
  selector: z.string().min(1),
  attribute: z.string().optional(),
  regex: z.string().optional(),
})

export const FieldExtractorSchema = z.discriminatedUnion('from', [
  z.object({ from: z.literal('selector'), selector: z.string().min(1), attribute: z.string().optional() }),
  z.object({ from: z.literal('selectorText'), selector: z.string().min(1) }),
  z.object({ from: z.literal('regex'), pattern: z.string().min(1), group: z.number().int().positive().optional() }),
  z
    .object({
      from: z.literal('sha1'),
      source: z.enum(['urlRelease', 'identifier', 'composite']),
      compositeFields: z.array(z.string().min(1)).optional(),
    })
    .superRefine((v, ctx) => {
      if (v.source === 'composite' && (!v.compositeFields || v.compositeFields.length === 0)) {
        ctx.addIssue({
          code: 'custom',
          path: ['compositeFields'],
          message: "sha1 extractor with source 'composite' requires compositeFields",
        })
      }
    }),
  z.object({
    from: z.literal('titleParse'),
    separator: z.string().min(1),
    artistSplit: z.string().optional(),
    stripTags: z.string().optional(),
  }),
  z.object({ from: z.literal('urlPath'), pattern: z.string().min(1), transform: z.enum(['capitalize', 'none']).optional() }),
  z.object({ from: z.literal('apiField'), field: z.string().min(1) }),
  z.object({ from: z.literal('hardcoded'), value: z.string() }),
  z.object({ from: z.literal('concat'), template: z.string().min(1), fields: z.array(z.string().min(1)) }),
  z.object({ from: z.literal('substr'), source: z.string().min(1), start: z.number().int(), end: z.number().int().optional() }),
  z.object({ from: z.literal('split'), fields: z.array(z.string().min(1)), delimiters: z.string().optional() }),
])

export const DownloadsConfigSchema = z.object({
  container: z.string().min(1).optional(),
  linkSelector: z.string().min(1).optional(),
  hostAttr: z.string().optional(),
  hostStatic: z.string().optional(),
  urlAttr: z.string().optional(),
  urlTemplate: z.string().min(1).optional(),
})

const GenreSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string(),
  query: z.string().optional(),
})

const SelectorOrStringSchema = z.union([z.string().min(1), SelectorConfigSchema])

const DownloadDetailSchema = z.object({
  container: z.string().min(1),
  linkSelector: z.string().min(1),
  hostAttr: z.string().optional(),
  hostStatic: z.string().optional(),
  urlAttr: z.string().optional(),
})

const SelectorsSchema = z.object({
  listPage: z.object({
    releaseContainer: z.string().min(1),
    title: SelectorOrStringSchema,
    urlRelease: SelectorOrStringSchema,
    nextPage: z.string().optional(),
  }),
  detailPage: z
    .object({
      cover: SelectorOrStringSchema.optional(),
      downloads: DownloadDetailSchema.optional(),
    })
    .optional(),
})

const ApiSchema = z.object({
  countUrlTemplate: z.string().optional(),
  resultsPath: z.string().optional(),
  countFieldPath: z.string().optional(),
  statusFieldPath: z.string().optional(),
  statusSuccessValue: z.string().optional(),
  errorMessagePath: z.string().optional(),
  apiKeyRequired: z.boolean().optional(),
  apiKeyField: z.string().optional(),
  apiKeyParamName: z.string().optional(),
  errorTranslations: z
    .array(z.object({ pattern: z.string().min(1), message: z.string().min(1) }))
    .optional(),
  clientSidePaginationField: z.string().optional(),
})

export const AdapterDefinitionSchema = z
  .object({
    version: z.literal('1.0'),
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    kind: z.enum(['html', 'api']),
    baseUrl: z.url(),
    supportsFastSkipExisting: z.boolean().optional(),
    fetch: z.object({
      mode: z.enum(['proxy', 'relay', 'direct']),
      relayBase: z.string().optional(),
      timeout: z.number().int().positive().optional(),
      headers: z.record(z.string(), z.string()).optional(),
    }),
    genres: z.object({
      source: z.enum(['hardcoded', 'dynamic']),
      items: z.array(GenreSchema).optional(),
      dynamicUrl: z.string().min(1).optional(),
      dynamicRegex: z.string().optional(),
      fallbackItems: z.array(GenreSchema).optional(),
    }),
    pagination: z.object({
      detection: z.enum(['api-count', 'binary-search', 'client-side', 'html-last-page']),
      mode: z.enum(['page-number', 'offset', 'client-side']),
      pageSize: z.number().int().positive(),
      maxPagesCap: z.number().int().positive().optional(),
      countFieldPath: z.string().optional(),
      lastPageRegex: z.string().optional(),
    }),
    scrapeMode: z.enum(['single-pass', 'two-phase']),
    api: ApiSchema.optional(),
    selectors: SelectorsSchema.optional(),
    urlTemplates: z.object({
      page: z.string().min(1),
      firstPage: z.string().optional(),
      search: z.string().optional(),
    }),
    fieldMapping: z.object({
      id: FieldExtractorSchema.optional(),
      title: FieldExtractorSchema.optional(),
      artists: FieldExtractorSchema.optional(),
      album: FieldExtractorSchema.optional(),
      label: FieldExtractorSchema.optional(),
      catalog: FieldExtractorSchema.optional(),
      year: FieldExtractorSchema.optional(),
      genre: FieldExtractorSchema.optional(),
      subgenres: FieldExtractorSchema.optional(),
      coverUrl: FieldExtractorSchema.optional(),
      downloads: DownloadsConfigSchema.optional(),
      urlRelease: FieldExtractorSchema.optional(),
      stableIdentity: FieldExtractorSchema.optional(),
    }),
    hardcodedFields: z
      .object({
        artists: z.array(z.string()).optional(),
        album: z.string().optional(),
        label: z.string().optional(),
        catalog: z.string().optional(),
        coverUrl: z.union([z.string(), z.null()]).optional(),
        genre: z.string().optional(),
        source: z.string().optional(),
      })
      .optional(),
  })
  .superRefine((def, ctx) => {
    if (def.kind === 'html' && !def.selectors?.listPage) {
      ctx.addIssue({
        code: 'custom',
        path: ['selectors', 'listPage'],
        message: 'HTML adapters require selectors.listPage',
      })
    }
    if (def.genres.source === 'hardcoded' && (!def.genres.items || def.genres.items.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['genres', 'items'],
        message: "genres.source 'hardcoded' requires at least one genre item",
      })
    }
    if (def.genres.source === 'dynamic' && !def.genres.dynamicUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['genres', 'dynamicUrl'],
        message: "genres.source 'dynamic' requires dynamicUrl",
      })
    }
    if (def.pagination.detection === 'html-last-page' && !def.pagination.lastPageRegex) {
      ctx.addIssue({
        code: 'custom',
        path: ['pagination', 'lastPageRegex'],
        message: "pagination.detection 'html-last-page' requires lastPageRegex",
      })
    }
  })

export type ParsedAdapterDefinition = z.infer<typeof AdapterDefinitionSchema>

export interface AdapterValidationError {
  path: string
  message: string
}

export interface AdapterParseResult {
  ok: boolean
  def?: AdapterDefinition
  errors?: AdapterValidationError[]
}

export function validateAdapterDefinition(value: unknown): AdapterParseResult {
  const result = AdapterDefinitionSchema.safeParse(value)
  if (result.success) {
    return { ok: true, def: result.data as unknown as AdapterDefinition }
  }
  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
      message: issue.message,
    })),
  }
}

export function parseAdapterJson(text: string): AdapterParseResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (err) {
    return {
      ok: false,
      errors: [{ path: 'JSON', message: (err as Error).message }],
    }
  }
  return validateAdapterDefinition(value)
}
