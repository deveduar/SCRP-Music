# Local adapters

This directory contains pluggable, source-specific adapters. Each adapter is independent and implements the shared `ScraperAdapter` contract. The app discovers adapters automatically with Vite's `import.meta.glob`.

## Adapter docs

This index lists neutral public examples. Additional local source-specific README files may exist next to their adapters.

- [`jamendo-README.md`](./jamendo-README.md)
- [`incompetech-README.md`](./incompetech-README.md)
- [`internet-archive-README.md`](./internet-archive-README.md)

## Structure

- `*.ts` adapter file(s): one adapter implementation per source
- `shared.ts`: shared helpers and `MUSIC_LINKS`
- `*.md`: source-specific adapter documentation

## Adapter interface

Each adapter must implement `ScraperAdapter` from `src/types/adapter.ts`.

```ts
export type AdapterKind = 'html' | 'api'

interface ScraperAdapter {
  id: string
  name: string
  description?: string
  kind: AdapterKind
  supportsFastSkipExisting?: boolean

  getGenres(): Genre[]
  getBaseUrl(): string
  getCachedMaxPage(genreId: string): { maxPage: number; detectedAt: string } | null
  clearCache(): void
  detectMaxPages(
    genreId: string,
    options: { proxyUrl: string },
    signal?: AbortSignal,
  ): Promise<number>

  getSearchLinks(): QuickLink[]

  scrape(
    options: ScrapeAdapterOptions,
    callbacks: ScrapeAdapterCallbacks,
    signal: AbortSignal,
    isPaused: () => boolean,
  ): Promise<void>
}
```

`supportsFastSkipExisting` is optional. Set it to `true` only when the adapter can identify existing releases from the listing page before fetching the individual detail page.

```ts
interface ScrapeAdapterOptions {
  genreId: string
  startPage: number
  endPage: number
  delayPage: number
  delayRelease: number
  proxyUrl: string
  fastSkipExisting?: boolean
}

interface ScrapeAdapterCallbacks {
  onProgress: (progress: ScrapeProgress) => void
  onPageDone: (page: number, count: number, skipped?: number) => void
  onReleaseDone: (release: Release) => void
  onReleaseSkipped?: (title: string) => void
  shouldSkipExistingRelease?: (candidate: {
    source: string
    title: string
    urlRelease: string
  }) => boolean
  onError: (msg: string) => void
  onComplete: (results: Release[]) => void
}
```

### Key adapter responsibilities

- `scrape()` must call `callbacks.onReleaseDone(release)` for each parsed release and `callbacks.onComplete(results)` when done.
- Use `callbacks.onError(msg)` for recoverable errors.
- Set `source` on each `Release` to the adapter `id`.
- `getSearchLinks()` should return music search links for the release card.
- `detectMaxPages()` and page-limit caching are adapter-specific.
- If `supportsFastSkipExisting=true`, check `options.fastSkipExisting` before fetching a detail page and call `callbacks.shouldSkipExistingRelease(...)` with `source`, `title`, and `urlRelease`.
- When skipping a known detail page, increment adapter progress and call `callbacks.onReleaseSkipped?.(title)`; do not emit `onReleaseDone()` for skipped releases.

## Shared utilities

### `shared.ts`

- Exposes `MUSIC_LINKS: QuickLink[]` for search platforms
- Use it from `getSearchLinks()` when the adapter provides generic music search buttons

### HTTP helpers

The core proxy helpers live in `src/services/cors-proxy.ts`:

- `fetchWithProxy(url, signal?, referer?)` — generic CORS proxy support, retrying 403/429 with backoff
- `fetchDirectRelay(relayBase, url, signal?, referer?)` — Vite relay for sources that need browser-native headers

### DOM parsing note

When parsing HTML with `DOMParser`, the resulting document inherits the app origin as `baseURI`. Use `getAttribute('href')` and `getAttribute('src')`, then build absolute URLs manually.

## Creating a new adapter

1. Create `local_adapters/<name>-adapter.ts`
2. Export a default class implementing `ScraperAdapter`
3. Set `kind: 'html' | 'api'` depending on the source
4. Return `MUSIC_LINKS` from `getSearchLinks()` if you want per-release music search buttons
5. Add a Vite relay proxy only if the adapter requires browser-native headers
6. Generate a stable `id` for each release, and optionally `stableIdentity` when the source has a stronger canonical identity
7. Set `supportsFastSkipExisting=true` only if listing data is enough to avoid fetching known detail pages
8. No core code changes required for normal adapters — the adapter is discovered automatically
