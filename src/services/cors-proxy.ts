const DEFAULT_PROXY = 'https://corsproxy.io/?'

let proxyUrl = DEFAULT_PROXY
let relayAvailable: boolean | null = null

function isProduction(): boolean {
  return typeof window !== 'undefined' && window.location.hostname !== 'localhost'
}

export function setProxyUrl(url: string) {
  proxyUrl = url
}

export function getProxyUrl(): string {
  return proxyUrl
}

export function isRelayAvailable(): boolean | null {
  return relayAvailable
}

export async function checkRelayHealth(): Promise<boolean> {
  if (!isProduction()) {
    relayAvailable = false
    return false
  }
  try {
    const resp = await fetch('/api/relay?health=1', { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) {
      relayAvailable = false
      return false
    }
    const data = await resp.json()
    relayAvailable = data.enabled === true
    return relayAvailable
  } catch {
    relayAvailable = false
    return false
  }
}

function buildFetchUrl(target: string): string {
  if (isProduction() && relayAvailable === true && !proxyUrl) {
    return `/api/relay?url=${encodeURIComponent(target)}`
  }
  return `${proxyUrl}${encodeURIComponent(target)}`
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function fetchWithProxy(url: string, signal?: AbortSignal, referer?: string): Promise<string> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  }
  if (referer) headers['Referer'] = referer

  const MAX_RETRIES = 3
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(buildFetchUrl(url), { signal, headers })
      if (resp.ok) return resp.text()
      if (resp.status === 403 || resp.status === 429) {
        if (attempt < MAX_RETRIES) {
          await delay(1000 * attempt * 2)
          continue
        }
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
      }
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
    } catch (err) {
      if (attempt < MAX_RETRIES && !signal?.aborted) {
        await delay(1000 * attempt * 2)
        continue
      }
      throw err
    }
  }
  throw new Error('Fetch failed after retries')
}

export async function fetchDirectRelay(
  baseRelay: string,
  url: string,
  signal?: AbortSignal,
  referer?: string,
): Promise<string> {
  const u = new URL(url)
  const relayUrl = `${baseRelay}${u.pathname}${u.search}`
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  }
  if (referer) headers['Referer'] = referer

  const MAX_RETRIES = 3
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(relayUrl, { signal, headers })
      if (resp.ok) return resp.text()
      if (resp.status === 403 || resp.status === 429) {
        if (attempt < MAX_RETRIES) {
          await delay(1000 * attempt * 2)
          continue
        }
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
      }
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
    } catch (err) {
      if (attempt < MAX_RETRIES && !signal?.aborted) {
        await delay(1000 * attempt * 2)
        continue
      }
      throw err
    }
  }
  throw new Error('Fetch failed after retries')
}

export function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}
