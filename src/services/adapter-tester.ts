import type { AdapterDefinition } from '../types/adapter-definition'
import type { Release } from '../types/release'
import { createAdapterFromDef, resolvePageUrl, fetchForDef } from './adapter-engine'
import { getProxyUrl } from './cors-proxy'
import { useSettingsStore } from '../stores/settings'

const SCRAPE_CAP = 5
const SCRAPE_TIMEOUT_MS = 45_000
const DETECT_TIMEOUT_MS = 30_000
const SNIPPET_LEN = 300

export interface AdapterTestSample {
  title: string
  coverUrl: string | null
  downloads: number
}

export interface AdapterTestResult {
  ok: boolean
  genresCount: number
  genresLabel: string
  maxPage: number | null
  maxPageError?: string
  page1Url?: string
  responseSnippet?: string
  samples: AdapterTestSample[]
  errors: string[]
  durationMs: number
  apiKeyMissing: boolean
}

export async function testAdapter(def: AdapterDefinition): Promise<AdapterTestResult> {
  const started = Date.now()
  const adapter = createAdapterFromDef(def)
  const errors: string[] = []

  const genres = adapter.getGenres()
  const genresCount = genres.length
  const firstGenre = genres[0]

  let apiKeyMissing = false
  let apiKey: string | undefined
  if (def.api?.apiKeyRequired && def.api.apiKeyField) {
    apiKey = useSettingsStore.getState().settings.apiKeys?.[def.api.apiKeyField]
    apiKeyMissing = !apiKey
  }

  // Mirror the engine's genre-query resolution
  let query: string | undefined
  if (def.urlTemplates.page.includes('{query}')) {
    if (def.genres.source === 'dynamic') {
      query = ''
    } else {
      query = def.genres.items?.find((g) => g.id === firstGenre?.id)?.query || ''
    }
  }

  let page1Url: string | undefined
  if (firstGenre) {
    page1Url = resolvePageUrl(def, firstGenre.id, 1, query, apiKey)
  }

  let maxPage: number | null = null
  let maxPageError: string | undefined
  if (firstGenre) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), DETECT_TIMEOUT_MS)
      maxPage = await adapter.detectMaxPages(
        firstGenre.id,
        { proxyUrl: getProxyUrl() },
        controller.signal,
      )
      clearTimeout(timeout)
    } catch (e) {
      maxPageError = (e as Error).message
      errors.push(`detectMaxPages: ${maxPageError}`)
    }
  }

  const samples: AdapterTestSample[] = []
  if (firstGenre) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS)
    try {
      await adapter.scrape(
        {
          genreId: firstGenre.id,
          startPage: 1,
          endPage: 1,
          delayPage: 0,
          delayRelease: 0,
          proxyUrl: getProxyUrl(),
          fastSkipExisting: false,
        },
        {
          onProgress: () => {},
          onPageDone: () => {},
          onReleaseDone: (release: Release) => {
            if (samples.length < SCRAPE_CAP) {
              samples.push({
                title: release.title,
                coverUrl: release.coverUrl,
                downloads: release.downloads.length,
              })
            }
            if (samples.length >= SCRAPE_CAP) controller.abort()
          },
          onError: (msg) => errors.push(msg),
          onComplete: () => {},
        },
        controller.signal,
        () => false,
      )
    } catch (e) {
      errors.push(`scrape: ${(e as Error).message}`)
    } finally {
      clearTimeout(timeout)
    }
  }

  let responseSnippet: string | undefined
  if (samples.length === 0 && page1Url) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      const raw = await fetchForDef(def, page1Url, controller.signal)
      clearTimeout(timeout)
      responseSnippet = raw.slice(0, SNIPPET_LEN)
    } catch (e) {
      responseSnippet = `(fetch failed: ${(e as Error).message})`
    }
  }

  const displayErrors = errors.filter((e) => !/cancelled|abort/i.test(e))

  return {
    ok: genresCount > 0 && samples.length > 0,
    genresCount,
    genresLabel: firstGenre?.label ?? 'No genres',
    maxPage,
    maxPageError,
    page1Url,
    responseSnippet,
    samples,
    errors: displayErrors,
    durationMs: Date.now() - started,
    apiKeyMissing,
  }
}
