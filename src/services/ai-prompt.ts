export interface AiSourceInput {
  url: string
  detailUrl: string
  kind: 'auto' | 'api' | 'html'
  sampleText: string
  sampleKind: 'json' | 'html' | 'unknown'
  sampleMode: 'fetched' | 'pasted' | 'none'
  sampleNote: string
  sampleTransport: string
  detailSampleText: string
  detailSampleKind: 'json' | 'html' | 'unknown'
  detailSampleMode: 'fetched' | 'none'
  detailSampleNote: string
  detailSampleTransport: string
  hints: string
  detailHints: string
  maxChars: number
  notes: string
  apiKeyHint: string
  headers: string
}

export function emptyAiSourceInput(): AiSourceInput {
  return {
    url: '',
    detailUrl: '',
    kind: 'auto',
    sampleText: '',
    sampleKind: 'unknown',
    sampleMode: 'none',
    sampleNote: '',
    sampleTransport: '',
    detailSampleText: '',
    detailSampleKind: 'unknown',
    detailSampleMode: 'none',
    detailSampleNote: '',
    detailSampleTransport: '',
    hints: '',
    detailHints: '',
    maxChars: 20000,
    notes: '',
    apiKeyHint: '',
    headers: '',
  }
}

const SCHEMA_BLOCK = `=== ADAPTER SCHEMA (v1.0) ===
{
  "version": "1.0",
  "id": "lowercase_no_spaces",
  "name": "Human friendly name",
  "kind": "html" | "api",
  "baseUrl": "https://...",
  "supportsFastSkipExisting": true,
  "fetch": {
    "mode": "relay" | "proxy" | "direct",
    "relayBase": "/api/relay",
    "timeout": 30000,
    "headers": { "Accept": "application/json" }
  },
  "genres": {
    "source": "hardcoded",
    "items": [ { "id": "all", "label": "All genres", "path": "", "query": "" } ]
  },
  "pagination": {
    "detection": "api-count" | "binary-search" | "client-side" | "html-last-page",
    "mode": "page-number" | "offset" | "client-side",
    "pageSize": 20,
    "maxPagesCap": 200,
    "countFieldPath": "path.to.total",
    "lastPageRegex": "page/([0-9]+)/"
  },
  "scrapeMode": "single-pass" | "two-phase",
  "api": {
    "resultsPath": "items",
    "countFieldPath": "total",
    "apiKeyRequired": false
  },
  "selectors": {
    "listPage": {
      "releaseContainer": "div.item",
      "title": "a.title",
      "urlRelease": "a",
      "nextPage": "a.next"
    },
    "detailPage": {
      "cover": "article img",
      "downloads": { "container": "div.dl", "linkSelector": "a[href]", "hostStatic": "My Host" }
    }
  },
  "urlTemplates": {
    "page": "/list/{genreId}/page/{page}/",
    "firstPage": "/list/{genreId}/"
  },
  "fieldMapping": {
    "id": { "from": "sha1", "source": "composite", "compositeFields": ["unique_id"] },
    "title": { "from": "apiField", "field": "title" },
    "artists": { "from": "apiField", "field": "artist" },
    "coverUrl": { "from": "apiField", "field": "cover" },
    "urlRelease": { "from": "concat", "template": "https://site.com/{0}", "fields": ["slug"] }
  }
}

OPTIONAL api fields (only if the source really has them):
- "statusFieldPath": "status"  + "statusSuccessValue": "ok"   ONLY when the API returns an explicit status field.
- "errorMessagePath" / "errorTranslations" — only for APIs with error payloads.
- "clientSidePaginationField" — path to the array when using detection "client-side".
- "countUrlTemplate" — separate URL that returns the total count.

pagination.lastPageRegex is REQUIRED when detection is "html-last-page": a regex whose first capture
group matches the biggest page number found in the pagination links (e.g. "page/([0-9]+)/" for /page/N/).
Derive it from the REAL DATA SAMPLE; do not invent one that does not match the sample.

OPTIONAL fieldMapping fields (only when the source provides them):
album, label, catalog, year, genre, subgenres, stableIdentity, downloads.
- downloads (API): { "urlTemplate": "{audio_field}", "hostStatic": "Host label" }.
- downloads (HTML): under selectors.detailPage.downloads.`

const EXTRACTORS_BLOCK = `=== FIELD EXTRACTORS ===
apiField {field} (supports dotted paths: artist.name) · concat {template, fields (template uses {0},{1}…)} ·
selector {selector, attribute} · selectorText {selector} · regex {pattern, group} ·
titleParse {separator, artistSplit, stripTags} · urlPath {pattern, transform} ·
substr {source, start, end} · split {fields, delimiters} · hardcoded {value} ·
sha1 {source: urlRelease | identifier | composite, compositeFields}

=== URL PLACEHOLDERS ===
{page} {offset} {pageSize} {genreId} {query} {path}
NOTE: for kind="api" the engine substitutes {offset} and {pageSize} in the URL; for kind="html" it does NOT.

=== TRANSPORT RULES ===
- fetch.mode MUST mirror the "Sample transport" (and "Detail sample transport") stated in MY SOURCE: direct, relay, or proxy.
  The app fetched the sample through that exact path and it worked, so the adapter must use the same one.
  Mapping: "direct" → fetch.mode "direct" · "relay" → fetch.mode "relay" · "proxy" → fetch.mode "proxy".
- Do NOT default HTML websites to "relay": the relay is a server-side (Node) fetch and Cloudflare-protected sites
  reject it with HTTP 403 "Attention Required". If the sample was fetched via "direct" (browser) or "proxy", use that mode.
- Only pick a different mode when the sample transport is unknown or not stated; then prefer "direct" for sites reachable
  from a browser, "proxy" for APIs behind CORS, and "relay" only for sites that block browser CORS but allow server-side fetch.`

const SAMPLE_GUIDANCE = `=== HOW TO BUILD THE ADAPTER ===
- REAL DATA SAMPLE below is the actual response of the Listing URL; DETAIL PAGE SAMPLE (if present) is the
  actual response of the Detail page URL. Analyze them to determine:
  kind ("api" if it is JSON, "html" if it is a web page), the array path (api.resultsPath, empty if the response IS an array),
  api.countFieldPath, selectors (for html), pagination (use {page}/{offset}/{pageSize} in urlTemplates.page if the URL paginates,
  or detection "client-side" / mode "client-side" if there is no pagination) and every fieldMapping path.
- From the LISTING sample map the list container and the fields visible on each item (title, artist, cover, release URL).
- From the DETAIL sample map cover, downloads (audio/stream URL or download links) and extra fields of a single
  release. In HTML mode, when the detail page shows more data than the list (cover, downloads), use
  scrapeMode "two-phase" and fill selectors.detailPage.
- If a sample is truncated, infer the structure from the visible part.
- The STRUCTURE HINTS block was auto-detected from the real page by the app (repeated item blocks,
  candidate selectors, JSON-LD, microdata, OpenGraph, feeds). You may use it, but verify every selector
  against the REAL DATA SAMPLE before using it.
- STRUCTURE HINTS also lists the candidate genres read from the site's navigation menus (label → /prefix/{id}/)
  and, when the Listing URL is itself a genre page, the genre URL pattern with {genreId} (e.g. /genre/{genreId}/).
  Fill genres.items ("hardcoded") from those candidates: id = slug, path = the genre path part ({genreId} value),
  label = the menu label. Cross-check the path segment against the Listing URL structure before using it.
- A sample may be JSON extracted from the page's embedded data (JSON-LD or JS payload) even though the page is HTML.
  In that case the page is JavaScript-rendered (or relies on embedded data) and the engine scrapes server-rendered HTML,
  so do NOT build an HTML adapter with invented selectors. Prefer the candidate selectors from STRUCTURE HINTS when they
  match the sample, or ask the user (in plain language) for a JSON API URL or for the list JSON from the browser Network tab.
- If there is NO sample, or the samples do not reveal the items, do NOT guess: reply asking the user
  (in plain language) for the missing piece before writing any JSON.`

const HARD_RULES = `=== HARD RULES ===
1. NEVER invent a baseUrl or a URL. The ONLY valid URLs are the Listing URL and the Detail page URL above — derive "baseUrl" from them (scheme + host). If the Listing URL is missing AND there is no sample, ask for it instead of fabricating a source.
2. NEVER invent JSON fields or HTML classes — only map what actually exists in the REAL DATA SAMPLE.
3. Do NOT add "statusFieldPath"/"statusSuccessValue" unless the API really returns an explicit status field — a missing status field makes every page fail with "API error: status undefined".
4. If the source has NO pagination, set detection "client-side" and mode "client-side".
5. If the response is already a JSON array, leave "resultsPath" EMPTY (do not invent a path).
6. downloads: only include if the sample shows an audio/stream URL (API field) or download links (HTML detail page). Otherwise omit entirely.
7. genres: use "hardcoded" with the real genres of the source. Prefer the candidates from STRUCTURE HINTS (they were read from the real site navigation and the Listing URL pattern); "query" goes into {query}, "path" goes into {path} (the genre's URL path segment). If it is a single list, one "all" genre with an empty query is fine.
8. id must be stable: prefer sha1 over a raw field.
9. For kind="api" do NOT use "selectors"; for kind="html" do NOT use "api".
10. Output ONLY the JSON. No markdown fences, no explanation.
11. The STRUCTURE HINTS block was extracted from the real page — you may use its candidate selectors, but verify each one exists in the REAL DATA SAMPLE first. Never invent selectors that are not present in the sample.
12. When pagination.detection is "html-last-page", you MUST include pagination.lastPageRegex: a regex with one capture group that matches the biggest page number in the pagination links of the REAL DATA SAMPLE (e.g. "page/([0-9]+)/" for /page/N/). A definition with detection "html-last-page" but without lastPageRegex is rejected by the app.
13. fetch.mode must equal the "Sample transport" stated in MY SOURCE (direct/relay/proxy). Never default HTML sites to "relay" — the relay is a server-side fetch that Cloudflare-protected sites reject with HTTP 403.`

function effectiveKindLabel(input: AiSourceInput): string {
  if (input.kind !== 'auto') return input.kind === 'api' ? 'api (user override)' : 'html (user override)'
  if (input.sampleKind === 'json') return 'api (detected from the JSON sample)'
  if (input.sampleKind === 'html') return 'html (detected from the HTML sample)'
  return 'unknown — determine from the sample'
}

export function buildAiPrompt(input: AiSourceInput): string {
  const lines = [
    `Listing URL: ${input.url.trim() || '(NOT PROVIDED — required!)'}`,
    `Detail page URL: ${input.detailUrl.trim() || '(not provided — optional)'}`,
    `Type: ${effectiveKindLabel(input)}`,
  ]
  if (input.sampleMode === 'fetched') {
    const extra = input.sampleNote.trim() ? ` — ${input.sampleNote.trim()}` : ''
    lines.push(`Sample: downloaded from the Listing URL (${input.sampleText.length} chars, ${input.sampleKind}${extra})`)
    if (input.sampleTransport.trim()) {
      lines.push(
        `Sample transport: ${input.sampleTransport.trim()} — the app fetched the sample through this path, so fetch.mode MUST mirror it.`,
      )
    }
  } else if (input.sampleMode === 'pasted') {
    lines.push(`Sample: pasted by the user (${input.sampleText.length} chars, ${input.sampleKind})`)
  } else {
    lines.push('Sample: NONE')
  }
  if (input.detailSampleMode === 'fetched' && input.detailSampleText.trim()) {
    const extra = input.detailSampleNote.trim() ? ` — ${input.detailSampleNote.trim()}` : ''
    lines.push(
      `Detail sample: downloaded from the Detail page URL (${input.detailSampleText.length} chars, ${input.detailSampleKind}${extra})`,
    )
    if (input.detailSampleTransport.trim()) {
      lines.push(`Detail sample transport: ${input.detailSampleTransport.trim()}`)
    }
  }
  if (input.apiKeyHint.trim()) lines.push(`API key: ${input.apiKeyHint.trim()}`)
  if (input.headers.trim()) lines.push(`Required headers: ${input.headers.trim()}`)
  if (input.notes.trim()) lines.push(`Notes: ${input.notes.trim()}`)
  const source = lines.join('\n')

  const sample = input.sampleText.trim()
    ? `\n\n=== REAL DATA SAMPLE ===\n${input.sampleText}\n`
    : ''
  const detailSample = input.detailSampleText.trim()
    ? `\n\n=== DETAIL PAGE SAMPLE ===\n${input.detailSampleText}\n`
    : ''
  const hints = input.hints.trim()
    ? `\n\n=== STRUCTURE HINTS (auto-detected from the page) ===\n${input.hints.trim()}${
        input.detailHints.trim() ? `\n\nDetail page:\n${input.detailHints.trim()}` : ''
      }\n`
    : ''

  const missing =
    !input.url.trim() && !input.sampleText.trim() && !input.detailSampleText.trim()
  const guardrail = missing
    ? '\n\n=== WARNING ===\nThe user did NOT provide a source URL or a data sample.\nDo NOT invent a source. Reply asking (in plain language) for the real listing URL or for a sample of the page/API response before writing any JSON.\n'
    : ''

  return `You create a single JSON object describing a music scraping adapter for the app "scrp-music".

OUTPUT: ONLY the JSON. No markdown fences, no explanation.

${SCHEMA_BLOCK}

${EXTRACTORS_BLOCK}

${SAMPLE_GUIDANCE}

${HARD_RULES}

=== MY SOURCE ===
${source}${sample}${detailSample}${hints}${guardrail}`
}
