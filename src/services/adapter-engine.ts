import type { Genre, ScrapeProgress } from '../types/scraper'
import type { Release, Download } from '../types/release'
import type { ScraperAdapter, ScrapeAdapterOptions, ScrapeAdapterCallbacks } from '../types/adapter'
import type { AdapterDefinition, FieldExtractor, SelectorConfig } from '../types/adapter-definition'
import { MUSIC_LINKS } from '../../local_adapters/shared'
import { fetchWithProxy, fetchDirectRelay, parseHtml } from './cors-proxy'
import { useSettingsStore } from '../stores/settings'

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function sha1(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hash = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function resolveSelector(doc: Document | Element, config: SelectorConfig | string): string | null {
  if (typeof config === 'string') {
    return doc.querySelector(config)?.textContent?.trim() ?? null
  }
  const el = doc.querySelector(config.selector)
  if (!el) return null
  if (config.attribute === 'textContent') {
    return el.textContent?.trim() ?? null
  }
  if (config.attribute) {
    return el.getAttribute(config.attribute) ?? null
  }
  if (config.regex) {
    const text = el.textContent ?? ''
    const match = text.match(new RegExp(config.regex))
    return match?.[1] ?? null
  }
  return el.textContent?.trim() ?? null
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function resolveCtxValue(context: Record<string, unknown>, path: string): unknown {
  const data = context.data
  if (data && typeof data === 'object') {
    const v = getNestedValue(data, path)
    if (v !== undefined) return v
  }
  return getNestedValue(context, path)
}

function parseTitle(titulo: string, separator: string, artistSplit?: string, stripTags?: string): { artists: string[]; album: string; year: number } {
  let cleaned = titulo
  if (stripTags) {
    cleaned = cleaned.replace(new RegExp(stripTags, 'i'), '').trim()
  }
  const yearMatch = cleaned.match(/\((\d{4})\)/)
  const year = yearMatch ? Number(yearMatch[1]) : 0
  const withoutYear = cleaned.replace(/\s*\(\d{4}\)\s*$/, '').trim()
  const separatorIndex = withoutYear.indexOf(separator)
  if (separatorIndex > 0) {
    const artistsStr = withoutYear.slice(0, separatorIndex).trim()
    const album = withoutYear.slice(separatorIndex + separator.length).trim()
    const splitChar = artistSplit || ','
    const artists = artistsStr.split(splitChar).map(a => a.trim()).filter(Boolean)
    return { artists, album, year }
  }
  return { artists: [], album: withoutYear, year }
}

function extractCatalogFromDownloads(downloads: Download[]): string {
  for (const d of downloads) {
    const match = d.url.match(/([A-Z0-9]{2,10}\d{2,4})/)
    if (match) return match[1]
  }
  return ''
}

function extractLabelFromTitle(titulo: string, catalog: string): string {
  const labelMatch = titulo.match(/\(([A-Za-z0-9 .&]+)\)/)
  if (labelMatch) return labelMatch[1].trim()
  const alphaMatch = catalog.match(/^([A-Za-z]+)/)
  if (alphaMatch) return alphaMatch[1]
  return ''
}

function genreFromUrl(url: string, pattern: string, transform?: 'capitalize' | 'none'): string {
  const match = url.match(pattern)
  if (!match?.[1]) return 'Unknown'
  let result = match[1]
  if (transform === 'capitalize') {
    result = result.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
  return result
}

type ExtractorResult = string | string[] | number | null

async function evaluateExtractor(
  extractor: FieldExtractor,
  context: {
    doc?: Document | Element
    data?: unknown
    urlRelease?: string
    downloads?: Download[]
    rawTitle?: string
  },
): Promise<ExtractorResult> {
  switch (extractor.from) {
    case 'selector': {
      if (!context.doc) return null
      return resolveSelector(context.doc, { selector: extractor.selector, attribute: extractor.attribute })
    }
    case 'selectorText': {
      if (!context.doc) return null
      return resolveSelector(context.doc, extractor.selector)
    }
    case 'regex': {
      const text = context.rawTitle || (context.doc?.textContent ?? '')
      const match = text.match(new RegExp(extractor.pattern))
      return match?.[extractor.group ?? 1] ?? null
    }
    case 'sha1': {
      let input = ''
      if (extractor.source === 'urlRelease' && context.urlRelease) {
        input = context.urlRelease
      } else if (extractor.source === 'identifier') {
        input = String(resolveCtxValue(context, 'identifier') ?? '')
      } else if (extractor.source === 'composite' && extractor.compositeFields) {
        input = extractor.compositeFields.map(f => String(resolveCtxValue(context, f) ?? '')).join('::')
      } else if (context.urlRelease) {
        input = context.urlRelease
      }
      return sha1(input)
    }
    case 'titleParse': {
      return context.rawTitle || ''
    }
    case 'urlPath': {
      if (!context.urlRelease) return null
      return genreFromUrl(context.urlRelease, extractor.pattern, extractor.transform)
    }
    case 'apiField': {
      if (!context.data) return null
      return String(getNestedValue(context.data, extractor.field) ?? '').trim()
    }
    case 'hardcoded': {
      return extractor.value
    }
    case 'concat': {
      const values = extractor.fields.map(f => String(resolveCtxValue(context, f) ?? ''))
      let result = extractor.template
      values.forEach((v, i) => {
        result = result.replace(`{${i}}`, v)
      })
      return result
    }
    case 'substr': {
      const source = String(resolveCtxValue(context, extractor.source) ?? '')
      return source.slice(extractor.start, extractor.end)
    }
    case 'split': {
      const parts: string[] = []
      for (const f of extractor.fields) {
        const v = String(resolveCtxValue(context, f) ?? '')
        if (v) parts.push(v)
      }
      return parts.flatMap(s => s.split(new RegExp(extractor.delimiters || '[,/;]+')).map(x => x.trim()).filter(Boolean))
    }
    default:
      return null
  }
}

const PAGE_LIMIT_CACHE_KEY_SUFFIX = '_page_limits'

function loadPageLimitCache(cacheKey: string): Record<string, { maxPage: number; detectedAt: string }> {
  try {
    const raw = JSON.parse(localStorage.getItem(cacheKey) || '{}')
    const result: Record<string, { maxPage: number; detectedAt: string }> = {}
    for (const [key, val] of Object.entries(raw)) {
      if (typeof val === 'number') {
        result[key] = { maxPage: val, detectedAt: new Date().toISOString() }
      } else {
        result[key] = val as { maxPage: number; detectedAt: string }
      }
    }
    return result
  } catch {
    return {}
  }
}

function savePageLimitCache(cacheKey: string, limits: Record<string, { maxPage: number; detectedAt: string }>) {
  localStorage.setItem(cacheKey, JSON.stringify(limits))
}

function getFetchFunction(def: AdapterDefinition): (url: string, signal?: AbortSignal, referer?: string) => Promise<string> {
  switch (def.fetch.mode) {
    case 'relay': {
      const relayBase = def.fetch.relayBase || '/api/relay'
      return (url, signal, referer) => fetchDirectRelay(relayBase, url, signal, referer)
    }
    case 'direct': {
      return async (url, signal, referer) => {
        const timeout = AbortSignal.timeout(def.fetch.timeout || 30000)
        const combined = signal ? combineSignals(signal, timeout) : timeout
        const headers: Record<string, string> = {
          Accept: 'application/json',
          ...def.fetch.headers,
        }
        if (referer) headers['Referer'] = referer
        const res = await fetch(url, { signal: combined, headers })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        return res.text()
      }
    }
    default:
      return (url, signal, referer) => fetchWithProxy(url, signal, referer)
  }
}

function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort(sig.reason)
      return controller.signal
    }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true })
  }
  return controller.signal
}

function extractReleasesFromListHtml(doc: Document, def: AdapterDefinition): { titulo: string; urlRelease: string }[] {
  if (!def.selectors) return []
  const { listPage } = def.selectors
  const containers = doc.querySelectorAll(listPage.releaseContainer)
  return Array.from(containers).map(el => {
    const titulo = resolveSelector(el, listPage.title) ?? ''
    let urlRelease = ''
    if (typeof listPage.urlRelease === 'string') {
      const a = el.querySelector(listPage.urlRelease)
      urlRelease = a?.getAttribute('href') ?? ''
    } else {
      urlRelease = el.getAttribute(listPage.urlRelease.attribute || 'href') ?? ''
      const link = el.querySelector(listPage.urlRelease.selector)
      urlRelease = link?.getAttribute(listPage.urlRelease.attribute || 'href') ?? urlRelease
    }
    if (urlRelease && !urlRelease.startsWith('http')) {
      urlRelease = def.baseUrl + (urlRelease.startsWith('/') ? '' : '/') + urlRelease
    }
    return { titulo, urlRelease }
  }).filter(r => r.titulo && r.urlRelease)
}

async function detectMaxPagesBinarySearch(
  def: AdapterDefinition,
  fetchFn: (url: string, signal?: AbortSignal) => Promise<string>,
  genreId: string,
  cacheKey: string,
  signal?: AbortSignal,
): Promise<number> {
  const cached = loadPageLimitCache(cacheKey)
  if (cached[genreId]) return cached[genreId].maxPage

  const cap = def.pagination.maxPagesCap || 5000

  async function pageHasContent(page: number): Promise<boolean> {
    try {
      const url = buildPageUrl(def, genreId, page)
      const html = await fetchFn(url, signal)
      const doc = parseHtml(html)
      const releases = extractReleasesFromListHtml(doc, def)
      return releases.length > 0
    } catch {
      return false
    }
  }

  let low = 1
  let high = 2
  while (await pageHasContent(high)) {
    low = high
    high *= 2
    if (high > cap) break
  }
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2)
    if (await pageHasContent(mid)) {
      low = mid
    } else {
      high = mid
    }
  }

  savePageLimitCache(cacheKey, {
    ...loadPageLimitCache(cacheKey),
    [genreId]: { maxPage: low, detectedAt: new Date().toISOString() },
  })
  return low
}

async function detectMaxPagesFromFirstPageHtml(
  def: AdapterDefinition,
  fetchFn: (url: string, signal?: AbortSignal) => Promise<string>,
  genreId: string,
  cacheKey: string,
  signal?: AbortSignal,
  query?: string,
): Promise<number> {
  const cached = loadPageLimitCache(cacheKey)
  if (cached[genreId]) return cached[genreId].maxPage

  try {
    const url = buildPageUrl(def, genreId, 1, query)
    const html = await fetchFn(url, signal)
    const regex = new RegExp(def.pagination.lastPageRegex || 'page/([0-9]+)/', 'gi')
    let maxPage = 1
    for (const m of html.matchAll(regex)) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n > maxPage) maxPage = n
    }
    maxPage = Math.min(maxPage, def.pagination.maxPagesCap || 5000)

    savePageLimitCache(cacheKey, {
      ...loadPageLimitCache(cacheKey),
      [genreId]: { maxPage, detectedAt: new Date().toISOString() },
    })
    return maxPage
  } catch {
    return detectMaxPagesBinarySearch(def, fetchFn, genreId, cacheKey, signal)
  }
}

async function detectMaxPagesApiCount(
  def: AdapterDefinition,
  fetchFn: (url: string, signal?: AbortSignal) => Promise<string>,
  genreId: string,
  cacheKey: string,
  signal?: AbortSignal,
  apiKey?: string,
  query?: string,
): Promise<number> {
  const cached = loadPageLimitCache(cacheKey)
  if (cached[genreId]) return cached[genreId].maxPage

  try {
    let url: string
    if (def.api?.countUrlTemplate) {
      url = def.api.countUrlTemplate.replace('{genreId}', genreId).replace('{query}', encodeURIComponent(query || ''))
      if (apiKey && def.api?.apiKeyParamName) {
        const separator = url.includes('?') ? '&' : '?'
        url += `${separator}${def.api.apiKeyParamName}=${apiKey}`
      }
    } else {
      url = buildPageUrl(def, genreId, 1, query)
    }
    const raw = await fetchFn(url, signal)
    const data = JSON.parse(raw)
    const countPath = def.api?.countFieldPath || def.pagination.countFieldPath || 'response.numFound'
    const total = Number(getNestedValue(data, countPath)) || 0
    const maxPage = Math.max(1, Math.ceil(total / def.pagination.pageSize))

    savePageLimitCache(cacheKey, {
      ...loadPageLimitCache(cacheKey),
      [genreId]: { maxPage, detectedAt: new Date().toISOString() },
    })
    return maxPage
  } catch {
    return 1
  }
}

function buildPageUrl(def: AdapterDefinition, genreId: string, page: number, query?: string): string {
  const isPageNumber = def.urlTemplates.page.includes('{page}')
  const genrePath = resolveGenrePath(def, genreId)
  let url = def.urlTemplates.page
    .replace('{page}', String(page))
    .replace('{genreId}', genreId)
    .replace('{query}', encodeURIComponent(query || ''))
    .replace('{path}', genrePath)

  if (def.urlTemplates.firstPage && page === 1) {
    let firstPage = def.urlTemplates.firstPage
      .replace('{genreId}', genreId)
      .replace('{query}', encodeURIComponent(query || ''))
      .replace('{path}', genrePath)
    if (!firstPage.startsWith('http')) firstPage = def.baseUrl + firstPage
    return firstPage
  }

  if (isPageNumber && page === 1 && def.urlTemplates.firstPage) {
    let firstPage = def.urlTemplates.firstPage
      .replace('{genreId}', genreId)
      .replace('{query}', encodeURIComponent(query || ''))
      .replace('{path}', genrePath)
    if (!firstPage.startsWith('http')) firstPage = def.baseUrl + firstPage
    return firstPage
  }

  if (url.startsWith('http')) return url
  return def.baseUrl + url
}

function buildApiUrl(def: AdapterDefinition, genreId: string, page: number, apiKey?: string, query?: string): string {
  const offset = (page - 1) * def.pagination.pageSize
  const genrePath = resolveGenrePath(def, genreId)
  let url = def.urlTemplates.page
    .replace('{page}', String(page))
    .replace('{offset}', String(offset))
    .replace('{genreId}', genreId)
    .replace('{pageSize}', String(def.pagination.pageSize))
    .replace('{query}', encodeURIComponent(query || ''))
    .replace('{path}', genrePath)

  if (apiKey && def.api?.apiKeyParamName) {
    const separator = url.includes('?') ? '&' : '?'
    url += `${separator}${def.api.apiKeyParamName}=${apiKey}`
  }

  if (!url.startsWith('http')) {
    url = def.baseUrl + url
  }

  return url
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function resolveGenrePath(def: AdapterDefinition, genreId: string): string {
  const items = def.genres.items || def.genres.fallbackItems || []
  return items.find(g => g.id === genreId)?.path || ''
}

export function createAdapterFromDef(def: AdapterDefinition): ScraperAdapter {
  const cacheKey = `${def.id}${PAGE_LIMIT_CACHE_KEY_SUFFIX}`

  return {
    id: def.id,
    name: def.name,
    description: def.description,
    kind: def.kind,
    supportsFastSkipExisting: def.supportsFastSkipExisting,

    getGenres(): Genre[] {
      return def.genres.items || def.genres.fallbackItems || []
    },

    getBaseUrl(): string {
      return def.baseUrl
    },

    getCachedMaxPage(genreId: string) {
      return loadPageLimitCache(cacheKey)[genreId] ?? null
    },

    clearCache(): void {
      localStorage.removeItem(cacheKey)
    },

    getSearchLinks() {
      return MUSIC_LINKS
    },

    async detectMaxPages(
      genreId: string,
      _options: { proxyUrl: string },
      signal?: AbortSignal,
    ): Promise<number> {
      const fetchFn = getFetchFunction(def)

      // Resolve API key if needed
      let apiKey: string | undefined
      if (def.api?.apiKeyRequired && def.api.apiKeyField) {
        const state = useSettingsStore.getState()
        apiKey = state.settings.apiKeys?.[def.api.apiKeyField]
      }

      // Resolve genre query if needed
      let query: string | undefined
      if (def.urlTemplates.page.includes('{query}')) {
        if (def.genres.source === 'dynamic' && def.genres.dynamicUrl) {
          try {
            const html = await fetchFn(def.genres.dynamicUrl, signal)
            if (def.genres.dynamicRegex) {
              const regex = new RegExp(def.genres.dynamicRegex, 'gs')
              const matches = [...html.matchAll(regex)]
              if (matches.length > 0) {
                const genreLookup = new Map<string, string>()
                for (const m of matches) {
                  const slug = slugify(m[2] || m[1])
                  genreLookup.set(slug, m[2] || m[1])
                }
                query = genreLookup.get(genreId) || ''
              }
            }
          } catch { /* ignore */ }
        } else if (def.genres.items) {
          const genreItem = def.genres.items.find(g => g.id === genreId)
          query = genreItem?.query || ''
        }
      }

      if (def.pagination.detection === 'binary-search') {
        return detectMaxPagesBinarySearch(def, fetchFn, genreId, cacheKey, signal)
      }

      if (def.pagination.detection === 'html-last-page') {
        return detectMaxPagesFromFirstPageHtml(def, fetchFn, genreId, cacheKey, signal, query)
      }

      if (def.pagination.detection === 'api-count') {
        return detectMaxPagesApiCount(def, fetchFn, genreId, cacheKey, signal, apiKey, query)
      }

      // client-side: fetch all and count
      try {
        const url = def.api?.clientSidePaginationField
          ? def.urlTemplates.search || def.urlTemplates.page
          : buildPageUrl(def, genreId, 1, query)
        const raw = await fetchFn(url, signal)
        const data = JSON.parse(raw)
        const itemsPath = def.api?.clientSidePaginationField
        const items = itemsPath ? getNestedValue(data, itemsPath) : data
        const total = Array.isArray(items) ? items.length : 0
        const maxPage = Math.max(1, Math.ceil(total / def.pagination.pageSize))
        savePageLimitCache(cacheKey, {
          ...loadPageLimitCache(cacheKey),
          [genreId]: { maxPage, detectedAt: new Date().toISOString() },
        })
        return maxPage
      } catch {
        return 1
      }
    },

    async scrape(
      options: ScrapeAdapterOptions,
      callbacks: ScrapeAdapterCallbacks,
      signal: AbortSignal,
      isPaused: () => boolean,
    ): Promise<void> {
      try {
        const fetchFn = getFetchFunction(def)
        const results: Release[] = []

        // Resolve API key if needed
        let apiKey: string | undefined
        if (def.api?.apiKeyRequired && def.api.apiKeyField) {
          const state = useSettingsStore.getState()
          const key = state.settings.apiKeys?.[def.api.apiKeyField]
          if (!key) {
            throw new Error(
              `${def.name} requires an API key. Add it in Settings > API Keys as "${def.api.apiKeyField}".`
            )
          }
          apiKey = key
        }

        // Resolve genres
        let genres = def.genres.items || def.genres.fallbackItems || []
        let genreLookup: Map<string, { label: string; slug: string }> | null = null
        if (def.genres.source === 'dynamic' && def.genres.dynamicUrl) {
          try {
            const html = await fetchFn(def.genres.dynamicUrl, signal)
            if (def.genres.dynamicRegex) {
              const regex = new RegExp(def.genres.dynamicRegex, 'gs')
              const matches = [...html.matchAll(regex)]
              if (matches.length > 0) {
                genreLookup = new Map()
                genres = matches.map(m => {
                  const numericId = m[1]
                  const label = m[2] || m[1]
                  const slug = slugify(label)
                  if (m[2]) genreLookup!.set(numericId, { label, slug })
                  return { id: slug, label, path: m[3] || '' }
                })
                genres = [{ id: 'all', label: 'All genres', path: '' }, ...genres]
              }
            }
          } catch {
            genres = def.genres.fallbackItems || genres
          }
        }

        const genreId = options.genreId
        const startPage = Math.max(1, options.startPage || 1)
        const endPage = Math.max(startPage, options.endPage || startPage)

      // Resolve genre query for {query} substitution
      let query: string | undefined
      if (def.urlTemplates.page.includes('{query}')) {
        if (genreLookup) {
          // Dynamic genres: look up by slug
          const resolved = genreLookup.get(genreId)
          query = resolved?.label || ''
        } else if (def.genres.items) {
          // Hardcoded genres: find by id
          const genreItem = def.genres.items.find(g => g.id === genreId)
          query = genreItem?.query || ''
        }
      }

        // Detect max pages
        let maxPage: number
        if (def.pagination.detection === 'client-side') {
          maxPage = await this.detectMaxPages(genreId, { proxyUrl: options.proxyUrl }, signal)
        } else {
          maxPage = await this.detectMaxPages(genreId, { proxyUrl: options.proxyUrl }, signal)
        }

        const actualEndPage = Math.min(endPage, maxPage)

        const progress: ScrapeProgress = {
          pagesTotal: Math.max(1, actualEndPage - startPage + 1),
          pagesDone: 0,
          releasesFound: 0,
          releasesScraped: 0,
          releasesSkipped: 0,
          currentPage: 0,
          currentRelease: '',
          errors: 0,
        }

        // Client-side pagination: fetch all, filter, slice
        if (def.pagination.detection === 'client-side') {
          try {
            const url = buildApiUrl(def, genreId, 1, apiKey, query)
            const raw = await fetchFn(url, signal)
            const data = JSON.parse(raw)
            const items = (def.api?.clientSidePaginationField
              ? (getNestedValue(data, def.api.clientSidePaginationField) || [])
              : (Array.isArray(data) ? data : [])) as Record<string, unknown>[]

            const filtered = genreId && genreId !== 'all'
              ? items.filter(item => {
                  const raw = String(item.genre || item.subject || '')
                  const resolved = genreLookup?.get(raw)
                  return (resolved?.slug ?? slugify(raw)) === genreId
                })
              : items

            const pageStart = (startPage - 1) * def.pagination.pageSize
            const pageEnd = actualEndPage * def.pagination.pageSize
            const sliced = filtered.slice(pageStart, pageEnd)

            for (const item of sliced) {
              if (signal.aborted) throw new Error('Scrape cancelled')
              while (isPaused()) await delay(500)

              progress.releasesFound++
              progress.currentRelease = String(item.title || '')

              try {
                const release = await mapFieldsFromData(def, item, genreId, genreLookup ?? undefined)
                progress.releasesScraped++
                callbacks.onReleaseDone(release)
                results.push(release)
              } catch (err) {
                progress.errors++
                callbacks.onError(`Error processing item: ${(err as Error).message}`)
              }

              if (options.delayRelease > 0) await delay(options.delayRelease)
            }

            progress.pagesDone = 1
            callbacks.onProgress({ ...progress })
            callbacks.onPageDone(1, sliced.length)
          } catch (err) {
            callbacks.onError((err as Error).message)
          }

          callbacks.onComplete(results)
          return
        }

        // Standard page-by-page scraping
        for (let page = startPage; page <= actualEndPage; page++) {
          if (signal.aborted) return
          while (isPaused()) await delay(500)

          progress.currentPage = page
          callbacks.onProgress({ ...progress })

          try {
            if (def.kind === 'api') {
              // API mode: fetch JSON
              const url = buildApiUrl(def, genreId, page, apiKey, query)
              const raw = await fetchFn(url, signal)
              const data = JSON.parse(raw)

              // Check API status
              if (def.api?.statusFieldPath) {
                const status = String(getNestedValue(data, def.api.statusFieldPath))
                if (def.api.statusSuccessValue && status !== def.api.statusSuccessValue) {
                  let msg = `API error: status ${status}`
                  if (def.api.errorMessagePath) {
                    const errMsg = String(getNestedValue(data, def.api.errorMessagePath) || '')
                    if (errMsg) {
                      const translation = def.api.errorTranslations?.find(t =>
                        new RegExp(t.pattern, 'i').test(errMsg)
                      )
                      msg = translation?.message || `API: ${errMsg}`
                    }
                  }
                  throw new Error(msg)
                }
              }

              // Get results array
              const resultsPath = def.api?.resultsPath || 'results'
              const items = getNestedValue(data, resultsPath)
              const itemsArray = Array.isArray(items) ? items : []

              progress.releasesFound += itemsArray.length
              callbacks.onProgress({ ...progress })

              for (const item of itemsArray) {
                if (signal.aborted) return
                while (isPaused()) await delay(500)

                progress.currentRelease = String(item?.title || item?.name || '')

                try {
                const release = await mapFieldsFromData(def, item, genreId, genreLookup ?? undefined)
                  progress.releasesScraped++
                  callbacks.onReleaseDone(release)
                  results.push(release)
                } catch (err) {
                  progress.errors++
                  callbacks.onError(`Error processing item: ${(err as Error).message}`)
                }

                await delay(options.delayRelease)
              }

              progress.pagesDone++
              callbacks.onPageDone(page, itemsArray.length)
            } else {
              // HTML mode
              const url = buildPageUrl(def, genreId, page)
              const html = await fetchFn(url, signal)
              const doc = parseHtml(html)
              const releases = extractReleasesFromListHtml(doc, def)

              progress.releasesFound += releases.length
              callbacks.onProgress({ ...progress })
              let pageSkipped = 0

              for (const release of releases) {
                if (signal.aborted) return
                while (isPaused()) await delay(500)

                progress.currentRelease = release.titulo
                callbacks.onProgress({ ...progress })

                // Fast skip existing
                if (options.fastSkipExisting && callbacks.shouldSkipExistingRelease?.({
                  source: def.id,
                  title: release.titulo,
                  urlRelease: release.urlRelease,
                })) {
                  progress.releasesSkipped++
                  pageSkipped++
                  callbacks.onReleaseSkipped?.(release.titulo)
                  callbacks.onProgress({ ...progress })
                  continue
                }

                if (def.scrapeMode === 'two-phase' && def.selectors?.detailPage) {
                  // Two-phase: fetch detail page
                  try {
                    const detailHtml = await fetchFn(release.urlRelease, signal, url)
                    const detailDoc = parseHtml(detailHtml)
                    const transformed = await mapFieldsFromHtml(def, release, detailDoc, genreId)
                    results.push(transformed)
                    progress.releasesScraped++
                    callbacks.onReleaseDone(transformed)
                  } catch (err) {
                    progress.errors++
                    // Graceful degradation: create partial release
                    const partial = await mapFieldsFromHtml(def, release, null, genreId)
                    results.push(partial)
                    callbacks.onError(`Error scraping release: ${release.titulo} — ${(err as Error).message}`)
                  }
                } else {
                  // Single-pass: map from list page
                  const transformed = await mapFieldsFromHtml(def, release, doc, genreId)
                  results.push(transformed)
                  progress.releasesScraped++
                  callbacks.onReleaseDone(transformed)
                }

                await delay(options.delayRelease)
              }

              progress.pagesDone++
              callbacks.onPageDone(page, releases.length, pageSkipped)
            }
          } catch (err) {
            progress.errors++
            callbacks.onError(`Error scraping page ${page}: ${(err as Error).message}`)
          }

          await delay(options.delayPage)
        }

        callbacks.onComplete(results)
      } catch (err) {
        callbacks.onError((err as Error).message)
        callbacks.onComplete([])
      }
    },
  }
}

async function mapFieldsFromData(
  def: AdapterDefinition,
  item: Record<string, unknown>,
  genreId: string,
  genreLookup?: Map<string, { label: string; slug: string }>,
): Promise<Release> {
  const ctx = { data: item, baseUrl: def.baseUrl }

  const idExtractor = def.fieldMapping.id || { from: 'sha1' as const, source: 'urlRelease' as const }
  const id = await evaluateExtractor(idExtractor, ctx) as string

  const titleExtractor = def.fieldMapping.title || { from: 'apiField' as const, field: 'title' }
  const title = await evaluateExtractor(titleExtractor, ctx) as string

  let artists: string[]
  if (def.hardcodedFields?.artists) {
    artists = def.hardcodedFields.artists
  } else {
    const artistExtractor = def.fieldMapping.artists || { from: 'apiField' as const, field: 'artist_name' }
    const rawArtists = await evaluateExtractor(artistExtractor, ctx)
    artists = Array.isArray(rawArtists) ? rawArtists : [String(rawArtists || '')]
  }

  const album = def.hardcodedFields?.album
    || await evaluateExtractor(def.fieldMapping.album || { from: 'apiField', field: 'album_name' }, ctx) as string
    || title

  const label = def.hardcodedFields?.label
    || await evaluateExtractor(def.fieldMapping.label || { from: 'hardcoded', value: '' }, ctx) as string

  const catalog = def.hardcodedFields?.catalog
    || await evaluateExtractor(def.fieldMapping.catalog || { from: 'hardcoded', value: '' }, ctx) as string

  const yearExtractor = def.fieldMapping.year || { from: 'apiField', field: 'year' }
  const rawYear = await evaluateExtractor(yearExtractor, ctx)
  const year = Number(rawYear) || 0

  const genreExtractor = def.fieldMapping.genre || { from: 'hardcoded', value: genreId }
  let genre = String(await evaluateExtractor(genreExtractor, ctx) || genreId)
  if (genreLookup?.has(genre)) {
    genre = genreLookup.get(genre)!.label
  }

  let coverUrl: string | null = def.hardcodedFields?.coverUrl ?? null
  if (!coverUrl && def.fieldMapping.coverUrl) {
    coverUrl = await evaluateExtractor(def.fieldMapping.coverUrl, ctx) as string | null
  }

  let downloads: Download[] = []
  if (def.fieldMapping.downloads) {
    const dlConfig = def.fieldMapping.downloads
    if (dlConfig.urlTemplate) {
      const url = dlConfig.urlTemplate
        .replace(/\{encode:([^}]+)\}/g, (_, f) => encodeURIComponent(String(resolveCtxValue(ctx, f) || '')))
        .replace(/\{([^}]+)\}/g, (_, f) => String(resolveCtxValue(ctx, f) || ''))
      downloads = [{ host: dlConfig.hostStatic || def.name, url }]
    } else {
      const downloadItems = getNestedValue(item, (dlConfig.container || '').replace(/\[\]/g, ''))
      if (Array.isArray(downloadItems)) {
        downloads = downloadItems.map((d: Record<string, unknown>) => ({
          host: dlConfig.hostStatic || String(d[dlConfig.hostAttr || 'host'] || ''),
          url: String(d[dlConfig.urlAttr || 'url'] || ''),
        }))
      }
    }
  }

  let urlRelease = String(resolveCtxValue(ctx, 'urlRelease') || resolveCtxValue(ctx, 'url_release') || '')
  if (def.fieldMapping.urlRelease) {
    urlRelease = String(await evaluateExtractor(def.fieldMapping.urlRelease, ctx) || urlRelease)
  }
  if (urlRelease && !urlRelease.startsWith('http')) {
    urlRelease = def.baseUrl + (urlRelease.startsWith('/') ? '' : '/') + urlRelease
  }

  const subgenres = def.fieldMapping.subgenres
    ? Array.from(await evaluateExtractor(def.fieldMapping.subgenres, ctx) as string[])
    : []

  let stableIdentity: string | undefined
  if (def.fieldMapping.stableIdentity) {
    stableIdentity = String(await evaluateExtractor(def.fieldMapping.stableIdentity, ctx) || undefined)
  }

  return {
    id,
    stableIdentity,
    source: def.hardcodedFields?.source || def.id,
    title,
    artists,
    album,
    label,
    catalog,
    year,
    genre,
    subgenres,
    urlRelease,
    coverUrl,
    scrapeDate: new Date().toISOString(),
    scrapeJobIds: [],
    downloads,
  }
}

async function mapFieldsFromHtml(
  def: AdapterDefinition,
  raw: { titulo: string; urlRelease: string },
  detailDoc: Document | null,
  genreId: string,
): Promise<Release> {
  const ctx = { doc: detailDoc || undefined, urlRelease: raw.urlRelease, rawTitle: raw.titulo }

  const idExtractor = def.fieldMapping.id || { from: 'sha1' as const, source: 'urlRelease' as const }
  const id = await evaluateExtractor(idExtractor, ctx) as string

  let title = raw.titulo
  if (def.fieldMapping.title) {
    title = String(await evaluateExtractor(def.fieldMapping.title, ctx) || raw.titulo)
  }

  let artists: string[]
  if (def.hardcodedFields?.artists) {
    artists = def.hardcodedFields.artists
  } else if (def.fieldMapping.artists?.from === 'titleParse') {
    const parsed = parseTitle(
      raw.titulo,
      def.fieldMapping.artists.separator,
      def.fieldMapping.artists.artistSplit,
      def.fieldMapping.artists.stripTags,
    )
    artists = parsed.artists
  } else if (def.fieldMapping.artists) {
    const rawArtists = await evaluateExtractor(def.fieldMapping.artists, ctx)
    artists = Array.isArray(rawArtists) ? rawArtists : [String(rawArtists || '')]
  } else {
    artists = []
  }

  let album = def.hardcodedFields?.album || title
  if (def.fieldMapping.album) {
    if (def.fieldMapping.album.from === 'titleParse') {
      const parsed = parseTitle(raw.titulo, def.fieldMapping.album.separator, def.fieldMapping.album.artistSplit, def.fieldMapping.album.stripTags)
      album = parsed.album
    } else {
      album = String(await evaluateExtractor(def.fieldMapping.album, ctx) || title)
    }
  }

  let label = def.hardcodedFields?.label || ''
  let catalog = def.hardcodedFields?.catalog || ''

  // Extract downloads
  let downloads: Download[] = []
  if (def.selectors?.detailPage?.downloads && detailDoc) {
    const dlConfig = def.selectors.detailPage.downloads
    const container = detailDoc.querySelector(dlConfig.container)
    if (container) {
      const links = container.querySelectorAll(dlConfig.linkSelector)
      downloads = Array.from(links).map(a => {
        const hostAttr = dlConfig.hostAttr || 'textContent'
        const host = hostAttr === 'textContent'
          ? a.textContent?.trim() || ''
          : a.getAttribute(hostAttr) || ''
        return {
          host: dlConfig.hostStatic || host,
          url: a.getAttribute(dlConfig.urlAttr || 'href') || '',
        }
      })
    }
  }

  // Extract catalog and label from downloads
  if (!catalog && downloads.length > 0) {
    catalog = extractCatalogFromDownloads(downloads)
  }
  if (!label) {
    label = extractLabelFromTitle(raw.titulo, catalog)
  }
  if (def.fieldMapping.label) {
    label = String(await evaluateExtractor(def.fieldMapping.label, ctx) || label)
  }
  if (def.fieldMapping.catalog) {
    catalog = String(await evaluateExtractor(def.fieldMapping.catalog, ctx) || catalog)
  }

  // Year from title parse
  let year = 0
  if (def.fieldMapping.year) {
    if (def.fieldMapping.year.from === 'titleParse') {
      const parsed = parseTitle(raw.titulo, def.fieldMapping.year.separator, def.fieldMapping.year.artistSplit, def.fieldMapping.year.stripTags)
      year = parsed.year
    } else {
      year = Number(await evaluateExtractor(def.fieldMapping.year, ctx)) || 0
    }
  } else {
    // Default: extract from title
    const yearMatch = raw.titulo.match(/\((\d{4})\)/)
    year = yearMatch ? Number(yearMatch[1]) : 0
  }

  // Genre
  let genre = genreId
  if (def.fieldMapping.genre) {
    if (def.fieldMapping.genre.from === 'urlPath' && detailDoc) {
      genre = genreFromUrl(raw.urlRelease, def.fieldMapping.genre.pattern, def.fieldMapping.genre.transform)
    } else {
      genre = String(await evaluateExtractor(def.fieldMapping.genre, ctx) || genreId)
    }
  }

  // Cover
  let coverUrl: string | null = null
  if (def.selectors?.detailPage?.cover && detailDoc) {
    const coverConfig = def.selectors.detailPage.cover
    if (typeof coverConfig === 'string') {
      coverUrl = detailDoc.querySelector(coverConfig)?.getAttribute('src') ?? null
    } else {
      coverUrl = resolveSelector(detailDoc, coverConfig)
    }
    if (coverUrl && !coverUrl.startsWith('http')) {
      coverUrl = def.baseUrl + coverUrl
    }
  }
  if (coverUrl === null && def.hardcodedFields?.coverUrl !== undefined) {
    coverUrl = def.hardcodedFields.coverUrl
  }

  let subgenres: string[] = []
  if (def.fieldMapping.subgenres) {
    subgenres = Array.from(await evaluateExtractor(def.fieldMapping.subgenres, ctx) as string[])
  }

  let stableIdentity: string | undefined
  if (def.fieldMapping.stableIdentity) {
    stableIdentity = String(await evaluateExtractor(def.fieldMapping.stableIdentity, ctx) || undefined)
  }

  return {
    id,
    stableIdentity,
    source: def.hardcodedFields?.source || def.id,
    title,
    artists,
    album,
    label,
    catalog,
    year,
    genre,
    subgenres,
    urlRelease: raw.urlRelease,
    coverUrl,
    scrapeDate: new Date().toISOString(),
    scrapeJobIds: [],
    downloads,
  }
}
