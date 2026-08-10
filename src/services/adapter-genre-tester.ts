import type { AdapterDefinition } from '../types/adapter-definition'
import { resolvePageUrl, fetchForDef } from './adapter-engine'
import { useSettingsStore } from '../stores/settings'

export interface GenreUrlCheck {
  id: string
  label: string
  url: string
  ok: boolean
  status?: string
  error?: string
}

const HTTP_STATUS_RE = /HTTP\s*(\d{3})/
const GENRE_TEST_TIMEOUT_MS = 30_000

function parseHttpStatus(err: unknown): string | undefined {
  const message = err instanceof Error ? err.message : String(err)
  return message.match(HTTP_STATUS_RE)?.[1]
}

export async function testGenres(
  def: AdapterDefinition,
  options: { limit?: number } = {},
): Promise<GenreUrlCheck[]> {
  const genres = def.genres.items || def.genres.fallbackItems || []
  const items = options.limit && options.limit > 0 ? genres.slice(0, options.limit) : genres

  let apiKey: string | undefined
  if (def.api?.apiKeyRequired && def.api.apiKeyField) {
    apiKey = useSettingsStore.getState().settings.apiKeys?.[def.api.apiKeyField]
  }

  const results: GenreUrlCheck[] = []
  for (const genre of items) {
    const query = def.urlTemplates.page.includes('{query}') ? (genre.query ?? '') : undefined
    const url = resolvePageUrl(def, genre.id, 1, query, apiKey)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), GENRE_TEST_TIMEOUT_MS)
    try {
      await fetchForDef(def, url, controller.signal)
      results.push({ id: genre.id, label: genre.label, url, ok: true })
    } catch (err) {
      const status = parseHttpStatus(err)
      results.push({
        id: genre.id,
        label: genre.label,
        url,
        ok: false,
        status,
        error: status ? `HTTP ${status}` : (err as Error)?.message ?? String(err),
      })
    } finally {
      clearTimeout(timeout)
    }
  }
  return results
}
