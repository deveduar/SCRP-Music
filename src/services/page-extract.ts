export interface CandidateSelector {
  kind: 'title' | 'urlRelease' | 'cover' | 'audio' | 'download'
  selector: string
  rel?: boolean
}

export interface JsonLdHit {
  type: string
  count: number
}

export interface MicrodataHit {
  itemtype: string
  count: number
}

export interface OgInfo {
  type: string
  title?: string
  image?: string
  audio?: string
  url?: string
}

export interface FeedInfo {
  type: string
  href: string
}

export interface MediaInfo {
  audio: string[]
  download: string[]
}

export interface GenreCandidate {
  id: string
  label: string
  path: string
}

export interface GenrePathInfo {
  pattern: string
  currentId: string
  prefix: string
}

export interface PageAnalysis {
  itemCount: number
  container: string | null
  candidates: CandidateSelector[]
  nextPage: string | null
  jsonLd: JsonLdHit[]
  jsonLdSample: string | null
  jsonLdListCount: number
  microdata: MicrodataHit[]
  og: OgInfo | null
  feeds: FeedInfo[]
  media: MediaInfo
  genres: GenreCandidate[]
  genrePath: GenrePathInfo | null
  shellDetected: boolean
}

const LIST_KEYS = ['itemListElement', 'tracks', 'track', 'mainEntity', 'hasPart']
const EXCLUDED_JSONLD_TYPES = /Breadcrumb|WebSite|Organization|WebPage|SearchAction|Question|FAQ/i
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'link', 'meta', 'title', 'head', 'svg'])
const CLASS_REQUIRED_TAGS = new Set(['div', 'section', 'span', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'tbody', 'button'])
const NOISE_CLASS_RE = /menu|nav|breadcrumb|social|pagination|footer|header|sidebar|widget|comment|advert|share|meta|pager|related/i
// Classes that vary per item (WordPress post id, taxonomies, formatting flags) break repeated-block grouping:
const SIGNATURE_NOISE_CLASS_RE = /\d|^(cat|category|tag|artist|record_label|author|status|format|type|has|tie|wp|attachment|size|align|taxonomy|is|entry)-/i
const GENRE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i
const NON_GENRE_FIRST_SEGMENT = /^(wp-content|wp-json|wp-admin|wp-login|wp-includes|feed|cdn-cgi|xmlrpc|author|artist|label|tag|search|account|profile|dashboard|login|logout|register|privacy|terms|about|contact|cart|checkout|shop|store|images?|img|assets|static|uploads|files|home)\b/i
const GENRE_UTILITY_IDS = /^(page|pages|feed|all|latest|new|new-releases|view-all|view|more|most-popular|popular|recent|archive|archives|home|shop|store|cart|checkout|contact|about|login|logout|register|search|genre|genres|category|categories|tag|tags|label|labels|artist|artists|author|authors)\d*$/i
const JSON_SAMPLE_MAX = 6000

export function parseHtmlForExtract(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

function sanitizeClass(c: string): string {
  return c.replace(/[^A-Za-z0-9_\-:]/g, '')
}

function elementSignature(el: Element): string | null {
  const tag = el.tagName.toLowerCase()
  if (SKIP_TAGS.has(tag)) return null
  const cls = Array.from(el.classList)
    .map(sanitizeClass)
    .filter((c) => c.length > 0 && !NOISE_CLASS_RE.test(c) && !SIGNATURE_NOISE_CLASS_RE.test(c))
    .sort()
  if (cls.length === 0 && CLASS_REQUIRED_TAGS.has(tag)) return null
  return tag + cls.map((c) => '.' + c).join('')
}

interface BlockGroup {
  count: number
  first: Element | null
}

function detectRepeatedBlocks(doc: Document): { container: string; count: number; sample: Element } | null {
  const all = Array.from(doc.querySelectorAll('*'))
  const index = new Map<Element, number>()
  all.forEach((e, i) => index.set(e, i))
  const groups = new Map<string, BlockGroup>()
  for (const el of all) {
    if (el.children.length === 0) continue
    if (!el.querySelector('a[href], img, audio, h1, h2, h3, h4, h5')) continue
    if (el.closest('nav, footer, header, aside, [role="navigation"]')) continue
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') continue
    const sig = elementSignature(el)
    if (!sig) continue
    const parent = el.parentElement
    const key = `${parent ? (index.get(parent) ?? -1) : -1}|${sig}`
    const g = groups.get(key)
    if (g) {
      g.count++
    } else {
      groups.set(key, { count: 1, first: el })
    }
  }
  let best: { container: string; count: number; sample: Element } | null = null
  for (const [key, g] of groups) {
    if (g.count < 3 || !g.first) continue
    const sig = key.slice(key.indexOf('|') + 1)
    if (!best || g.count > best.count) best = { container: sig, count: g.count, sample: g.first }
  }
  return best
}

function pickBestTitle(item: Element): Element | null {
  let best: Element | null = null
  let bestScore = -1
  const consider = (el: Element, base: number) => {
    const text = (el.textContent ?? '').trim()
    if (!text) return
    let score = base
    if (/title|name|track|song|album/i.test(el.className.toString())) score += 20
    if (text.length < 120) score += 5
    if (score > bestScore) {
      bestScore = score
      best = el
    }
  }
  for (const a of item.querySelectorAll('a')) {
    if ((a.textContent ?? '').trim()) consider(a, 30)
  }
  for (const h of item.querySelectorAll('h1, h2, h3, h4, h5')) consider(h, 25)
  for (const el of item.querySelectorAll('[class*="title" i], [class*="name" i], [class*="track" i], [class*="song" i], [class*="album" i]')) consider(el, 18)
  return best
}

function relativeSelector(item: Element, target: Element): string {
  if (item === target) return ':scope'
  const tag = target.tagName.toLowerCase()
  const cls = Array.from(target.classList)
    .map(sanitizeClass)
    .filter((c) => c.length > 0)
  if (cls.length > 0) return tag + cls.map((c) => '.' + c).join('')
  const path: string[] = []
  let el: Element | null = target
  while (el && el !== item) {
    const parentEl: Element | null = el.parentElement
    if (!parentEl || parentEl === el) break
    const idx = Array.from(parentEl.children).indexOf(el) + 1
    path.unshift(`${el.tagName.toLowerCase()}:nth-of-type(${idx})`)
    el = parentEl
  }
  return path.join(' > ') || tag
}

function candidateSelectors(item: Element): CandidateSelector[] {
  const out: CandidateSelector[] = []
  const title = pickBestTitle(item)
  const urlRelease = (() => {
    if (title && title.getAttribute('href')) return title
    return item.querySelector('a[href]')
  })()
  if (urlRelease) {
    if (title === urlRelease) {
      out.push({ kind: 'title', selector: relativeSelector(item, urlRelease), rel: true })
    } else if (title) {
      out.push({ kind: 'title', selector: relativeSelector(item, title), rel: true })
      out.push({ kind: 'urlRelease', selector: relativeSelector(item, urlRelease), rel: true })
    } else {
      out.push({ kind: 'urlRelease', selector: relativeSelector(item, urlRelease), rel: true })
    }
  }
  const img = item.querySelector('img')
  if (img) out.push({ kind: 'cover', selector: relativeSelector(item, img), rel: true })
  const audioEl = item.querySelector('audio[src]')
  if (audioEl) out.push({ kind: 'audio', selector: relativeSelector(item, audioEl), rel: true })
  const dl = item.querySelector(
    'a[href*=".mp3"], a[href*=".flac"], a[href*=".wav"], a[href*=".ogg"], a[href*=".m4a"], a[href*="/download"], a[href*="/dl/"], a[download]',
  )
  if (dl) out.push({ kind: 'download', selector: relativeSelector(item, dl), rel: true })
  return out
}

function simpleSelector(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const cls = Array.from(el.classList)
    .map(sanitizeClass)
    .filter((c) => c.length > 0)
  return cls.length ? `${tag}.${cls.join('.')}` : tag
}

function findNextPage(doc: Document): string | null {
  const link = doc.querySelector('link[rel="next"]')
  if (link) return 'link[rel="next"]'
  const anchors = Array.from(doc.querySelectorAll('a'))
  const byClass = anchors.find((a) => /(next|older|pagination|pager)/i.test(a.className.toString()))
  if (byClass) return simpleSelector(byClass)
  const byText = anchors.find((a) => /^\s*(next|older|siguiente|more)\b/i.test(a.textContent ?? ''))
  return byText ? simpleSelector(byText) : null
}

function parseJsonLdScripts(html: string): unknown[] {
  const out: unknown[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1].trim()))
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return out
}

interface JsonLdScan {
  types: Map<string, number>
  bestList: { arr: unknown[]; type: string; key: string } | null
}

function scanJsonLd(value: unknown, info: JsonLdScan): void {
  if (Array.isArray(value)) {
    for (const v of value) scanJsonLd(v, info)
    return
  }
  if (!value || typeof value !== 'object') return
  const obj = value as Record<string, unknown>
  const rawType = obj['@type']
  const types = (Array.isArray(rawType) ? rawType : [rawType]).filter((t): t is string => typeof t === 'string')
  for (const t of types) info.types.set(t, (info.types.get(t) || 0) + 1)
  const ownType = types[0]
  if (ownType && !EXCLUDED_JSONLD_TYPES.test(ownType)) {
    for (const key of LIST_KEYS) {
      const arr = obj[key]
      if (Array.isArray(arr) && arr.length >= 2 && arr[0] && typeof arr[0] === 'object') {
        const first = arr[0] as Record<string, unknown>
        if ('name' in first || 'url' in first || 'track' in first) {
          if (!info.bestList || arr.length > info.bestList.arr.length) {
            info.bestList = { arr, type: ownType, key }
          }
        }
      }
    }
  }
  for (const key of Object.keys(obj)) scanJsonLd(obj[key], info)
}

function truncateJson(value: unknown): string {
  const arr = value as unknown[]
  let out = JSON.stringify(arr.slice(0, 8), null, 2)
  if (out.length > JSON_SAMPLE_MAX) out = out.slice(0, JSON_SAMPLE_MAX) + '\n… (truncated)'
  return out
}

export function extractJsonLdList(html: string): { json: string; count: number; label: string } | null {
  const info: JsonLdScan = { types: new Map(), bestList: null }
  for (const script of parseJsonLdScripts(html)) scanJsonLd(script, info)
  if (!info.bestList) return null
  return {
    json: truncateJson(info.bestList.arr),
    count: info.bestList.arr.length,
    label: `${info.bestList.type} > ${info.bestList.key}`,
  }
}

function collectOg(doc: Document): OgInfo | null {
  const get = (p: string): string | undefined =>
    doc.querySelector(`meta[property="${p}"]`)?.getAttribute('content') ||
    doc.querySelector(`meta[name="${p}"]`)?.getAttribute('content') ||
    undefined
  const type = get('og:type')
  if (!type) return null
  return { type, title: get('og:title'), image: get('og:image'), audio: get('og:audio'), url: get('og:url') }
}

function collectFeeds(doc: Document): FeedInfo[] {
  const out: FeedInfo[] = []
  for (const l of doc.querySelectorAll('link[rel="alternate"]')) {
    const type = (l.getAttribute('type') || '').toLowerCase()
    const href = l.getAttribute('href')
    if (!href) continue
    if (type.includes('rss')) out.push({ type: 'rss', href })
    else if (type.includes('atom')) out.push({ type: 'atom', href })
  }
  return out
}

function collectMicrodata(doc: Document): MicrodataHit[] {
  const map = new Map<string, number>()
  for (const el of doc.querySelectorAll('[itemtype]')) {
    const t = el.getAttribute('itemtype')?.trim() ?? ''
    if (!t) continue
    map.set(t, (map.get(t) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([itemtype, count]) => ({ itemtype, count }))
    .sort((a, b) => b.count - a.count)
}

function resolveUrl(href: string, baseUrl?: string): string {
  if (!baseUrl) return href
  try {
    return new URL(href, baseUrl).href
  } catch {
    return href
  }
}

function collectMedia(doc: Document, baseUrl?: string): MediaInfo {
  const audio: string[] = []
  const download: string[] = []
  const seen = new Set<string>()
  const push = (list: string[], raw: string | null | undefined) => {
    if (!raw) return
    const href = raw.trim()
    if (!href || href.startsWith('data:') || href === '#') return
    const resolved = resolveUrl(href, baseUrl)
    if (seen.has(resolved)) return
    seen.add(resolved)
    list.push(resolved)
  }
  for (const el of doc.querySelectorAll('audio[src]')) push(audio, el.getAttribute('src'))
  for (const el of doc.querySelectorAll('source[src]')) {
    const src = el.getAttribute('src') || ''
    const type = (el.getAttribute('type') || '').toLowerCase()
    if (type.includes('audio') || /\.(mp3|ogg|wav|flac|m4a|opus)(\?|$)/i.test(src)) push(audio, src)
  }
  for (const el of doc.querySelectorAll('a[href]')) {
    const href = el.getAttribute('href') || ''
    if (/\.(mp3|flac|wav|ogg|m4a|opus)(\?|$)/i.test(href)) push(audio, href)
    else if (el.hasAttribute('download') || /(\/download|\/dl\/|download=)/i.test(href)) push(download, href)
  }
  return { audio: audio.slice(0, 8), download: download.slice(0, 8) }
}

export function deriveGenrePathFromUrl(baseUrl?: string): GenrePathInfo | null {
  if (!baseUrl) return null
  let u: URL
  try {
    u = new URL(baseUrl)
  } catch {
    return null
  }
  const segs = u.pathname.split('/').filter(Boolean)
  if (segs.length < 2) return null
  const id = decodeURIComponent(segs[segs.length - 1])
  if (!GENRE_SLUG_RE.test(id) || GENRE_UTILITY_IDS.test(id) || /^\d+$/.test(id)) return null
  const prefix = segs.slice(0, -1).join('/')
  if (NON_GENRE_FIRST_SEGMENT.test(prefix)) return null
  return { pattern: `/${prefix}/{genreId}/`, currentId: id, prefix }
}

export function detectGenres(doc: Document, baseUrl?: string): GenreCandidate[] {
  const groupMap = new Map<string, Map<string, string>>()
  const seen = new Set<string>()
  const baseOrigin = baseUrl ? safeOrigin(baseUrl) : null
  const anchors = new Set<Element>()
  for (const sel of ['nav a[href]', 'header a[href]', '[id*="menu"] a[href]', '[class*="menu"] a[href]', 'ul.menu a[href]', 'a[href]']) {
    for (const el of doc.querySelectorAll(sel)) anchors.add(el)
  }
  for (const el of anchors) {
    const hrefRaw = el.getAttribute('href')
    if (!hrefRaw) continue
    const href = hrefRaw.trim()
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue
    const resolved = resolveUrl(href, baseUrl)
    if (seen.has(resolved)) continue
    seen.add(resolved)
    let u: URL
    try {
      u = new URL(resolved)
    } catch {
      continue
    }
    if (baseOrigin && u.origin !== baseOrigin) continue
    const segs = u.pathname.split('/').filter(Boolean)
    if (segs.length < 2) continue
    if (NON_GENRE_FIRST_SEGMENT.test(segs[0])) continue
    const id = decodeURIComponent(segs[segs.length - 1])
    if (!GENRE_SLUG_RE.test(id) || /^\d+$/.test(id) || GENRE_UTILITY_IDS.test(id)) continue
    const prefix = segs.slice(0, -1).join('/')
    if (/\b(page|pages|feed|latest|new|popular)\b/i.test(prefix)) continue
    const label = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60) || id
    const group = groupMap.get(prefix) ?? new Map<string, string>()
    if (!group.has(id)) group.set(id, label)
    groupMap.set(prefix, group)
  }
  const out: GenreCandidate[] = []
  for (const [prefix, ids] of groupMap) {
    if (ids.size < 2) continue
    const path = `/${prefix}/{id}/`
    for (const [id, label] of ids) out.push({ id, label, path })
  }
  return out.sort((a, b) => a.path.localeCompare(b.path) || a.label.localeCompare(b.label)).slice(0, 40)
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export function analyzePage(html: string, baseUrl?: string): PageAnalysis {
  const doc = parseHtmlForExtract(html)
  const block = detectRepeatedBlocks(doc)
  const info: JsonLdScan = { types: new Map(), bestList: null }
  for (const script of parseJsonLdScripts(html)) scanJsonLd(script, info)
  const candidates = block ? candidateSelectors(block.sample) : []
  const jsonLd = Array.from(info.types.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
  const media = collectMedia(doc, baseUrl)
  const genres = detectGenres(doc, baseUrl)
  const genrePath = deriveGenrePathFromUrl(baseUrl)
  const hasItems =
    (block?.count ?? 0) > 0 || info.bestList !== null || collectMicrodata(doc).length > 0
  return {
    itemCount: block?.count ?? 0,
    container: block?.container ?? null,
    candidates,
    nextPage: findNextPage(doc),
    jsonLd,
    jsonLdSample: info.bestList ? truncateJson(info.bestList.arr) : null,
    jsonLdListCount: info.bestList?.arr.length ?? 0,
    microdata: collectMicrodata(doc),
    og: collectOg(doc),
    feeds: collectFeeds(doc),
    media,
    genres,
    genrePath,
    shellDetected: !hasItems && media.audio.length === 0 && media.download.length === 0,
  }
}

export function buildHintsText(a: PageAnalysis): string {
  const lines: string[] = []
  if (a.itemCount > 0) {
    lines.push(`Item list detected: ${a.itemCount} repeated items — container selector: ${a.container}`)
  }
  if (a.candidates.length > 0) {
    const parts = a.candidates
      .map((c) => `${c.kind}=${c.selector}${c.rel ? ' (relative to the container)' : ''}`)
      .join('\n')
    lines.push(`Candidate selectors:\n${parts}`)
  }
  if (a.nextPage) lines.push(`Pagination link detected: ${a.nextPage}`)
  if (a.jsonLd.length > 0) {
    lines.push(
      `Embedded JSON-LD: ${a.jsonLd
        .map((j) => `${j.type}${j.count > 1 ? ` ×${j.count}` : ''}`)
        .join(', ')}`,
    )
  }
  if (a.jsonLdSample) {
    lines.push(`Embedded JSON-LD contains a full item list (${a.jsonLdListCount} items) — included as the sample when no server-rendered list is found.`)
  }
  if (a.microdata.length > 0) {
    lines.push(`Microdata: ${a.microdata.map((m) => `${m.itemtype} ×${m.count}`).join(', ')}`)
  }
  if (a.og) {
    const og = [`og:type=${a.og.type}`]
    if (a.og.title) og.push(`og:title="${a.og.title}"`)
    if (a.og.image) og.push('og:image present')
    if (a.og.audio) og.push(`og:audio=${a.og.audio}`)
    lines.push(`OpenGraph: ${og.join(' · ')}`)
  }
  if (a.feeds.length > 0) {
    lines.push(`Feeds: ${a.feeds.map((f) => `${f.type} ${f.href}`).join(', ')}`)
  }
  if (a.media.audio.length > 0) {
    lines.push(
      `Direct audio URLs: ${a.media.audio.slice(0, 3).join(', ')}${a.media.audio.length > 3 ? ' …' : ''}`,
    )
  }
  if (a.genrePath) {
    lines.push(
      `The Listing URL is itself a genre page: pattern ${a.genrePath.pattern} (current id: ${a.genrePath.currentId}). Use {genreId} in urlTemplates.page / firstPage. Fill genres.items from the candidates below: id = the last path segment of the URL (the slug), path = that same slug (only needed if the template contains {path}), label = the menu label. Copy the slug EXACTLY as shown — never rebuild it from the label.`,
    )
  }
  if (a.genres.length > 0) {
    const prefix = a.genrePath ? `/${a.genrePath.prefix}/` : null
    const relevant = prefix ? a.genres.filter((g) => g.path.startsWith(prefix)) : a.genres
    const rest = prefix ? a.genres.filter((g) => !g.path.startsWith(prefix)) : []
    const print = (list: GenreCandidate[]) =>
      list.map((g) => `${g.label} → ${g.path.replace('{id}', g.id)}`).join('\n')
    if (relevant.length > 0) {
      const header = a.genrePath
        ? `Candidate genres for ${a.genrePath.pattern} (found in the site navigation):`
        : 'Candidate genres (found in the site navigation):'
      lines.push(`${header}\n${print(relevant)}`)
    }
    if (rest.length > 0) {
      lines.push(
        `Other navigation links that may be genres (verify against the URL structure):\n${print(rest)}`,
      )
    }
  }
  return lines.join('\n')
}
