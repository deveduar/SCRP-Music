const SCRAPE_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
]

const SCRAPE_TIMEOUT = 8000
const API_TIMEOUT = 3000

const videoCache = new Map<string, string>()

export function getCachedVideoId(query: string): string | undefined {
  return videoCache.get(query)
}

// ─── API search (fast attempt) ──────────────────────────────────────

async function tryApiSearch(query: string): Promise<string | null> {
  const url = `https://yt.lemnoslife.com/noKey/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT)
  try {
    const resp = await fetch(url, { signal: controller.signal })
    if (!resp.ok) return null
    const data: any = await resp.json()
    const id: string | undefined = data?.items?.[0]?.id?.videoId
    return id ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ─── Scrape search (the approach that actually works) ───────────────

function findVideoIdInObject(obj: unknown): string | null {
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const r = findVideoIdInObject(item)
        if (r) return r
      }
    } else {
      const o = obj as Record<string, unknown>
      if (typeof o.videoId === 'string') return o.videoId
      for (const key of Object.keys(o)) {
        const r = findVideoIdInObject(o[key])
        if (r) return r
      }
    }
  }
  return null
}

function extractYtInitialData(html: string): string | null {
  const start = html.indexOf('ytInitialData = ')
  if (start === -1) return null
  const jsonStart = start + 'ytInitialData = '.length
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i]
    if (esc) { esc = false; continue }
    if (ch === '\\' && inStr) { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (!inStr) {
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) return html.slice(jsonStart, i + 1)
      }
    }
  }
  return null
}

function extractIdFromJson(jsonStr: string): string | null {
  try {
    return findVideoIdInObject(JSON.parse(jsonStr))
  } catch {
    return null
  }
}

function extractVideoId(html: string): string | null {
  // Method 1: ytInitialData JSON
  const jsonStr = extractYtInitialData(html)
  if (jsonStr) {
    const id = extractIdFromJson(jsonStr)
    if (id) return id
  }

  // Method 2: regex on raw HTML
  const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)
  if (match) return match[1]

  return null
}

async function scrapeSingle(url: string, proxy: string): Promise<string | null> {
  const fullUrl = `${proxy}${encodeURIComponent(url)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT)
  try {
    const resp = await fetch(fullUrl, { signal: controller.signal })
    if (!resp.ok) return null
    const html = await resp.text()
    if (html.length < 1000) return null
    return extractVideoId(html)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function tryScrapeSearch(query: string): Promise<string | null> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
  for (const proxy of SCRAPE_PROXIES) {
    const id = await scrapeSingle(url, proxy)
    if (id) return id
  }
  return null
}

// ─── Public API ─────────────────────────────────────────────────────

export async function searchYouTube(query: string): Promise<string | null> {
  const cached = videoCache.get(query)
  if (cached !== undefined) return cached

  // 1. Fast API attempt (yt.lemnoslife.com)
  let id = await tryApiSearch(query)
  if (id) {
    videoCache.set(query, id)
    return id
  }

  // 2. Scrape YouTube search results (the reliable approach)
  id = await tryScrapeSearch(query)
  if (id) {
    videoCache.set(query, id)
    return id
  }

  videoCache.set(query, '')
  return null
}
