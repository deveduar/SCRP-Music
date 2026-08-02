const DEFAULT_PROXY = 'https://corsproxy.io/?'

let proxyUrl = DEFAULT_PROXY

export function setProxyUrl(url: string) {
  proxyUrl = url
}

export function getProxyUrl(): string {
  return proxyUrl
}

function proxyUrlEncode(target: string): string {
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
      const resp = await fetch(proxyUrlEncode(url), { signal, headers })
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
