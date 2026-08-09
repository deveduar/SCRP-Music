import { fetchWithProxy, fetchDirectRelay, isRelayAvailable } from './cors-proxy'
import { analyzePage, buildHintsText, extractJsonLdList } from './page-extract'
import type { PageAnalysis } from './page-extract'

export type SampleKind = 'json' | 'html' | 'unknown'
export type SampleMode = 'direct' | 'relay' | 'proxy' | 'pasted' | 'none'

export interface SourceSample {
  ok: boolean
  text: string
  kind: SampleKind
  mode: SampleMode
  length: number
  shellDetected: boolean
  note?: string
  error?: string
  hints?: string
}

export interface SampleOptions {
  maxChars?: number
  url?: string
}

const JSON_MAX = 6000
const HTML_MAX = 8000
const REGION_MAX = 16000
const DETAIL_MAX = 14000
const RELAY_BASE = '/api/relay'
const DIRECT_TIMEOUT_MS = 10_000

export function detectSampleKind(text: string): SampleKind {
  const trimmed = text.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      /* not valid JSON — fall through */
    }
  }
  if (trimmed.startsWith('<')) return 'html'
  return 'unknown'
}

function truncateJson(text: string, max = JSON_MAX): string {
  try {
    const data = JSON.parse(text)
    const sliced = Array.isArray(data) ? data.slice(0, 8) : data
    let out = JSON.stringify(sliced, null, 2)
    if (out.length > max) out = out.slice(0, max) + '\n… (truncated)'
    return out
  } catch {
    return text.length > max ? text.slice(0, max) + '\n… (truncated)' : text
  }
}

function stripHtmlNoise(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
}

function findMarker(text: string, marker: string): number {
  let idx = text.indexOf(marker)
  while (idx >= 0) {
    const after = text[idx + marker.length] ?? ''
    if (!/[a-zA-Z0-9-]/.test(after)) return idx
    idx = text.indexOf(marker, idx + 1)
  }
  return -1
}

const CONTENT_ANCHORS = [
  'id="main-content"',
  "id='main-content'",
  'id="maincontent"',
  "id='maincontent'",
  'id="tie-main"',
  "id='tie-main'",
  'id="content"',
  "id='content'",
  'id="main"',
  "id='main'",
  'class="site-main"',
  "class='site-main'",
  'class="post-list"',
  "class='post-list'",
  'class="posts-list"',
  "class='posts-list'",
  'class="entry-content"',
  "class='entry-content'",
  'class="post-content"',
  "class='post-content'",
  'class="tracklist"',
  "class='tracklist'",
  'class="track-list"',
  "class='track-list'",
]

function findContentAnchor(text: string): number {
  let best = -1
  for (const a of CONTENT_ANCHORS) {
    const idx = text.indexOf(a)
    if (idx >= 0 && (best === -1 || idx < best)) best = idx
  }
  const main = findMarker(text, '<main')
  if (main >= 0 && (best === -1 || main < best)) best = main
  return best
}

function scoreItemTag(tag: string): number {
  if (/^<article\b/i.test(tag)) return 60
  const lower = tag.toLowerCase()
  if (/^<li\b/i.test(lower)) {
    let score = 5
    if (/menu|nav|breadcrumb|social|pagination|footer|meta|share/i.test(lower)) score -= 40
    if (/post|entry|track|result|release|product|item|music|song|album|gallery|card|media/i.test(lower)) score += 25
    return score
  }
  if (/^<section\b/i.test(lower)) {
    if (/menu|nav|breadcrumb|social|footer|header/i.test(lower)) return -20
    if (/post|entry|track|list|content|result|release|music|album|gallery|archive/i.test(lower)) return 20
    return -5
  }
  return -1
}

function pickItemMarker(text: string, from: number): number | null {
  let bestIdx = -1
  let bestScore = 0
  const re = /<li\b|<article\b|<section\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index < from) continue
    const gt = text.indexOf('>', m.index)
    const tag = gt >= 0 ? text.slice(m.index, gt + 1) : text.slice(m.index, m.index + 40)
    const score = scoreItemTag(tag)
    if (score >= 60) return m.index
    if (score > bestScore) {
      bestScore = score
      bestIdx = m.index
    }
  }
  return bestIdx >= 0 ? bestIdx : null
}

function findContainerIndex(text: string, selector: string): number {
  const parts = selector.split('.')
  const tag = parts.shift() ?? ''
  if (!tag) return -1
  const rx = new RegExp(`<${tag}\\b[^>]*?>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = rx.exec(text)) !== null) {
    if (parts.length === 0) return m.index
    const attr = m[0].match(/(?:class|className)=["']([^"']*)["']/i)
    const cls = attr ? attr[1].split(/\s+/) : []
    if (parts.every((c) => cls.includes(c))) return m.index
  }
  return -1
}

function closeTagFor(tag: string): string {
  if (tag === 'li') return '</li>'
  if (tag === 'article') return '</article>'
  if (tag === 'tr') return '</tr>'
  if (tag === 'section') return '</section>'
  return ''
}

function lastItemOpen(text: string, from: number, to: number): { pos: number; tag: string } | null {
  const re = /<li\b|<article\b|<tr\b|<section\b/gi
  let m: RegExpExecArray | null
  let best: { pos: number; tag: string } | null = null
  while ((m = re.exec(text)) !== null) {
    if (m.index < from) continue
    if (m.index >= to) break
    const tag = m[0] === '<li' ? 'li' : m[0] === '<article' ? 'article' : m[0] === '<tr' ? 'tr' : 'section'
    best = { pos: m.index, tag }
  }
  return best
}

function nextItemOpen(text: string, from: number, to: number): { pos: number; tag: string } | null {
  const re = /<li\b|<article\b|<tr\b|<section\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index < from) continue
    if (m.index >= to) break
    const tag = m[0] === '<li' ? 'li' : m[0] === '<article' ? 'article' : m[0] === '<tr' ? 'tr' : 'section'
    return { pos: m.index, tag }
  }
  return null
}

function countItems(text: string, from: number, to: number): number {
  const re = /<li\b|<article\b|<tr\b/gi
  let count = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index >= from && m.index < to) count++
  }
  return count
}

function sliceCompleteItems(text: string, start: number, max: number): { text: string; count: number } {
  if (start >= text.length) return { text: '', count: 0 }
  const end = Math.min(text.length, start + max)
  if (end >= text.length) return { text: text.slice(start), count: countItems(text, start, end) }
  let sliceEnd = end
  const last = lastItemOpen(text, start, end)
  if (last) {
    const close = closeTagFor(last.tag)
    if (close) {
      const ci = text.indexOf(close, last.pos)
      if (ci >= 0) sliceEnd = Math.min(text.length, ci + close.length)
    }
  }
  let count = countItems(text, start, sliceEnd)
  if (count < 2) {
    const cap2 = Math.min(text.length, start + max * 3)
    const extra = nextItemOpen(text, sliceEnd, cap2)
    if (extra) {
      const c2 = text.indexOf(closeTagFor(extra.tag), extra.pos)
      if (c2 >= 0) sliceEnd = Math.min(text.length, c2 + closeTagFor(extra.tag).length)
      count = countItems(text, start, sliceEnd)
    }
  }
  const out = text.slice(start, sliceEnd)
  if (sliceEnd < text.length) {
    return { text: out + `\n\n… (truncated after ${count} item${count === 1 ? '' : 's'})`, count }
  }
  return { text: out, count }
}

function sliceHtmlRegion(
  text: string,
  max = REGION_MAX,
  analysis?: PageAnalysis,
): { text: string; found: boolean; itemCount: number } {
  const stripped = stripHtmlNoise(text)
  let idx = analysis?.container ? findContainerIndex(stripped, analysis.container) : -1
  if (idx < 0) {
    const anchor = findContentAnchor(stripped)
    const from = anchor >= 0 ? anchor : 0
    idx = pickItemMarker(stripped, from) ?? -1
    if (idx < 0 && anchor >= 0) idx = pickItemMarker(stripped, 0) ?? -1
  }
  if (idx < 0) return { text: '', found: false, itemCount: 0 }
  const start = Math.max(0, idx - 2500)
  const slice = sliceCompleteItems(stripped, start, max)
  return { text: slice.text, found: true, itemCount: analysis?.itemCount || slice.count }
}

interface PayloadCandidate {
  label: string
  raw: string
}

function balancedSlice(text: string, start: number): string | null {
  const open = text[start]
  if (open !== '{' && open !== '[') return null
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function extractPayloadCandidates(html: string): PayloadCandidate[] {
  const out: PayloadCandidate[] = []

  const scIdx = html.indexOf('__sc_hydration')
  if (scIdx >= 0) {
    const open = html.indexOf('[', scIdx)
    if (open >= 0) {
      const body = balancedSlice(html, open)
      if (body) out.push({ label: 'sc_hydration', raw: body })
    }
  }

  for (const name of ['__NEXT_DATA__', '__NUXT__', '__PRELOADED_STATE__', '__INITIAL_STATE__']) {
    const keyIdx = html.indexOf(name)
    if (keyIdx < 0) continue
    const eq = html.indexOf('=', keyIdx)
    if (eq < 0) continue
    const open = html.slice(eq + 1).search(/(\{|\[)/)
    if (open < 0) continue
    const body = balancedSlice(html, eq + 1 + open)
    if (body) out.push({ label: name, raw: body })
  }

  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/g,
  )
  for (const m of scripts) out.push({ label: 'json-script', raw: m[1] })

  return out
}

function walkArrays(value: unknown, out: unknown[]): void {
  if (Array.isArray(value)) {
    out.push(value)
    for (const v of value) walkArrays(v, out)
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      walkArrays((value as Record<string, unknown>)[key], out)
    }
  }
}

function bestItemsArray(payload: unknown): unknown[] | null {
  const arrays: unknown[][] = []
  walkArrays(payload, arrays)
  let best: unknown[] | null = null
  let bestScore = 0
  for (const arr of arrays) {
    if (arr.length < 2) continue
    const first = arr[0]
    if (!first || typeof first !== 'object') continue
    const keys = Object.keys(first as Record<string, unknown>)
    if (keys.length === 0) continue
    const titleish = /title|name|track|permalink|id/i.test(keys.join(' ')) ? 10 : 0
    const score = Math.min(10, arr.length) + Math.min(15, keys.length) + titleish
    if (score > bestScore) {
      bestScore = score
      best = arr
    }
  }
  return best
}

export function extractBestJsonPayload(html: string): string | null {
  for (const cand of extractPayloadCandidates(html)) {
    let raw = cand.raw
    const open = raw.search(/(\{|\[)/)
    if (open > 0) {
      const balanced = balancedSlice(raw, open)
      if (balanced) raw = balanced
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    const items = bestItemsArray(parsed)
    if (items) return truncateJson(JSON.stringify(items, null, 2))
  }
  return null
}

export function makeSample(text: string, mode: Exclude<SampleMode, 'pasted' | 'none'>, opts?: SampleOptions): SourceSample {
  const maxChars = opts?.maxChars && opts.maxChars > 0 ? opts.maxChars : REGION_MAX
  const analysis = analyzePage(text, opts?.url)
  const hints = buildHintsText(analysis)
  const kind = detectSampleKind(text)
  if (kind === 'json') {
    return {
      ok: true,
      text: truncateJson(text),
      kind,
      mode,
      length: text.length,
      shellDetected: false,
      hints,
    }
  }

  const region = sliceHtmlRegion(text, maxChars, analysis)
  if (region.found) {
    return {
      ok: true,
      text: region.text,
      kind: 'html',
      mode,
      length: text.length,
      shellDetected: false,
      note: `item list region — ${region.itemCount} items`,
      hints,
    }
  }

  const jsonLd = extractJsonLdList(text)
  if (jsonLd) {
    return {
      ok: true,
      text: jsonLd.json,
      kind: 'json',
      mode,
      length: text.length,
      shellDetected: false,
      note: `extracted from embedded JSON-LD (${jsonLd.label}, ${jsonLd.count} items; the page is HTML)`,
      hints,
    }
  }

  const embedded = extractBestJsonPayload(text)
  if (embedded) {
    return {
      ok: true,
      text: embedded,
      kind: 'json',
      mode,
      length: text.length,
      shellDetected: false,
      note: "extracted from the page's embedded data (the page itself is JS-rendered)",
      hints,
    }
  }

  const shell = stripHtmlNoise(text).slice(0, HTML_MAX)
  return {
    ok: true,
    text: shell,
    kind: 'html',
    mode,
    length: text.length,
    shellDetected: true,
    note: 'page shell only — no list items found',
    hints,
  }
}

const DETAIL_ANCHORS = [
  '<article',
  'itemprop="articleBody"',
  "itemprop='articleBody'",
  'class="entry-content"',
  "class='entry-content'",
  'class="post-content"',
  "class='post-content'",
  'class="post-body"',
  "class='post-body'",
  'class="single-post"',
  "class='single-post'",
  'id="content"',
  "id='content'",
  'id="main"',
  "id='main'",
]

function sliceDetailRegion(text: string, max = DETAIL_MAX): { text: string; found: boolean } {
  const stripped = stripHtmlNoise(text)
  let idx = -1
  for (const a of DETAIL_ANCHORS) {
    const i = a === '<article' ? findMarker(stripped, '<article') : stripped.indexOf(a)
    if (i >= 0) {
      idx = i
      break
    }
  }
  if (idx === -1) return { text: '', found: false }
  const start = Math.max(0, idx - 1500)
  let end = idx + 11000
  const close = stripped.indexOf('</article>', idx)
  if (close >= 0 && close + 10 <= start + max) end = close + 10
  end = Math.min(stripped.length, end)
  if (end <= start) return { text: '', found: false }
  let slice = stripped.slice(start, end)
  if (end < stripped.length && slice.length > max) slice = slice.slice(0, max) + '\n… (truncated)'
  return { text: slice, found: true }
}

export function makeDetailSample(
  text: string,
  mode: Exclude<SampleMode, 'pasted' | 'none'>,
  opts?: SampleOptions,
): SourceSample {
  const maxChars = opts?.maxChars && opts.maxChars > 0 ? opts.maxChars : DETAIL_MAX
  const analysis = analyzePage(text, opts?.url)
  const hints = buildHintsText(analysis)
  const kind = detectSampleKind(text)
  if (kind === 'json') {
    return {
      ok: true,
      text: truncateJson(text),
      kind,
      mode,
      length: text.length,
      shellDetected: false,
      hints,
    }
  }

  const region = sliceDetailRegion(text, maxChars)
  if (region.found) {
    return {
      ok: true,
      text: region.text,
      kind: 'html',
      mode,
      length: text.length,
      shellDetected: false,
      note: 'detail article region',
      hints,
    }
  }

  const jsonLd = extractJsonLdList(text)
  if (jsonLd) {
    return {
      ok: true,
      text: jsonLd.json,
      kind: 'json',
      mode,
      length: text.length,
      shellDetected: false,
      note: `extracted from embedded JSON-LD (${jsonLd.label}, ${jsonLd.count} items; the page is HTML)`,
      hints,
    }
  }

  const embedded = extractBestJsonPayload(text)
  if (embedded) {
    return {
      ok: true,
      text: embedded,
      kind: 'json',
      mode,
      length: text.length,
      shellDetected: false,
      note: "extracted from the detail page's embedded data (the page itself is JS-rendered)",
      hints,
    }
  }

  const shell = stripHtmlNoise(text).slice(0, HTML_MAX)
  return {
    ok: true,
    text: shell,
    kind: 'html',
    mode,
    length: text.length,
    shellDetected: true,
    note: 'detail page shell only — no article content found',
    hints,
  }
}

function sanitizeSampleUrl(url: string): string {
  return url
    .replace('{query}', '')
    .replace('{genreId}', '')
    .replace('{path}', '')
    .replace('{page}', '1')
    .replace('{offset}', '0')
    .replace('{pageSize}', '20')
}

async function fetchWithTimeout(url: string, ms: number, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController()
  const onAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms)
  try {
    return await fetch(url, { signal: controller.signal, redirect: 'follow' })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

async function tryDirect(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const resp = await fetchWithTimeout(url, DIRECT_TIMEOUT_MS, signal)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return await resp.text()
  } catch {
    return null
  }
}

async function fetchRawText(
  url: string,
  signal?: AbortSignal,
): Promise<{ text: string; mode: 'direct' | 'relay' | 'proxy' }> {
  const direct = await tryDirect(url, signal)
  if (direct !== null) return { text: direct, mode: 'direct' }

  if (isRelayAvailable() !== false) {
    try {
      const text = await fetchDirectRelay(RELAY_BASE, url, signal)
      return { text, mode: 'relay' }
    } catch {
      /* fall through to proxy */
    }
  }

  const text = await fetchWithProxy(url, signal)
  return { text, mode: 'proxy' }
}

export async function fetchSourceSample(
  url: string,
  signal?: AbortSignal,
  opts?: SampleOptions,
): Promise<SourceSample> {
  const target = sanitizeSampleUrl(url.trim())
  if (!target) {
    return {
      ok: false,
      text: '',
      kind: 'unknown',
      mode: 'none',
      length: 0,
      shellDetected: false,
      error: 'No URL provided',
    }
  }

  try {
    const { text, mode } = await fetchRawText(target, signal)
    return makeSample(text, mode, { ...opts, url: target })
  } catch (err) {
    return {
      ok: false,
      text: '',
      kind: 'unknown',
      mode: 'none',
      length: 0,
      shellDetected: false,
      error: err instanceof Error ? err.message : 'Could not reach the URL',
    }
  }
}

export async function fetchDetailSample(
  url: string,
  signal?: AbortSignal,
  opts?: SampleOptions,
): Promise<SourceSample> {
  const target = sanitizeSampleUrl(url.trim())
  if (!target) {
    return {
      ok: false,
      text: '',
      kind: 'unknown',
      mode: 'none',
      length: 0,
      shellDetected: false,
      error: 'No URL provided',
    }
  }

  try {
    const { text, mode } = await fetchRawText(target, signal)
    return makeDetailSample(text, mode, { ...opts, url: target })
  } catch (err) {
    return {
      ok: false,
      text: '',
      kind: 'unknown',
      mode: 'none',
      length: 0,
      shellDetected: false,
      error: err instanceof Error ? err.message : 'Could not reach the URL',
    }
  }
}

export interface SamplePair {
  listing: SourceSample
  detail: SourceSample | null
}

export async function fetchSourceSamples(
  listingUrl: string,
  detailUrl: string,
  signal?: AbortSignal,
  opts?: SampleOptions,
): Promise<SamplePair> {
  const detail = detailUrl.trim()
  const [listing, detailSample] = await Promise.all([
    fetchSourceSample(listingUrl, signal, opts),
    detail ? fetchDetailSample(detail, signal, opts).catch(() => null) : Promise.resolve(null),
  ])
  return { listing, detail: detailSample }
}
