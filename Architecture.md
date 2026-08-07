# Arquitectura — SCRP Music

## Visión general

SPA (Single Page Application) para navegar, buscar y gestionar releases musicales provenientes de scraping via un sistema de **adaptadores declarativos (JSON)** interpretados por un motor genérico. Sin backend salvo un relay opcional de CORS (Vercel Serverless / middleware Vite). El JSON de cada adaptador nunca se modifica — es la fuente de verdad del comportamiento de scraping. El estado de usuario (favoritos, escuchados, historial, notas) y los releases scrapeados se almacenan en IndexedDB vía Dexie y persisten entre recargas.

Docs relacionados: [`NETWORK.md`](./NETWORK.md) (modos de red, relay, configuración por source) y [`doc_deploy_relay.md`](./doc_deploy_relay.md) (deploy del relay).

---

## Stack tecnológico

| Capa             | Tecnología                        |
| ---------------- | --------------------------------- |
| Framework        | React 19 + TypeScript 6          |
| Bundler          | Vite 8                           |
| Routing          | React Router 7                   |
| Estado           | Zustand 5                        |
| Persistencia     | Dexie 4 (IndexedDB)              |
| Búsqueda         | Fuse.js 7 (fuzzy search)         |
| Virtualización   | TanStack Virtual 3               |
| CSS              | TailwindCSS 4 (`@tailwindcss/vite`) |
| Iconos           | Lucide React                     |
| Proxy CORS       | Relay `/api/relay` (Vercel serverless + middleware Vite dev) + CORS proxy configurable (corsproxy.io, allorigins.win…) |

---

## Estructura del proyecto

```
src/
├── types/                    # Interfaces del modelo de datos
│   ├── adapter-definition.ts     # AdapterDefinition (esquema JSON de adaptadores)
│   ├── adapter.ts                # Contrato ScraperAdapter (lo implementa el engine)
│   ├── release.ts                # ScrapedRelease (legacy), Release, Download
│   ├── user-state.ts             # UserReleaseState, HistoryEntry, UserSettings
│   ├── scraper.ts                # Genre, ScrapeJob, ScrapeProgress
│   ├── links.ts                  # QuickLink interface
│   └── export.ts                 # ExportPayload (para export/import global)
├── services/                 # Lógica pura (sin React) — agnóstica del origen
│   ├── adapter-engine.ts         # createAdapterFromDef(): interpreta un AdapterDefinition como ScraperAdapter
│   ├── adapter-definitions.ts    # Carga de local_adapters/*.json + lookup por id
│   ├── cors-proxy.ts             # Red: fetch con proxy / relay directo / directo, timeout, health check
│   ├── fetch-info.ts             # getFetchInfo(): transporte efectivo por adapter (para la UI)
│   ├── release-identity.ts       # Candidatos de identidad para merge anti-duplicados
│   ├── search.ts                 # Índice Fuse.js + sort + filter
│   ├── youtube.ts                # Búsqueda YouTube (API + scraping)
│   ├── batch-actions.ts          # Apertura secuencial de tabs + batch state ops
│   └── links.ts                  # GLOBAL_LINKS, ADAPTER_LINKS registry, buildSearchQuery
├── storage/                  # Capa IndexedDB
│   └── db.ts                     # Dexie schema v3 + helpers CRUD + export/import
├── stores/                   # Estado global (Zustand)
│   ├── releases.ts               # Releases store (carga, merge, búsqueda, filtros)
│   ├── user-state.ts             # Favoritos, listen, history, notes
│   ├── settings.ts               # Modo oscuro, items per page, proxy URL, API keys
│   ├── network.ts                # Entorno (dev/prod) + disponibilidad del relay (reactivo)
│   ├── scraper.ts                # Scraper state (adapter-aware, jobs, progreso, log)
│   └── youtube.ts                # Coordinación de reproducción YouTube entre releases
├── components/               # Componentes reutilizables
│   ├── ThemeProvider.tsx
│   ├── Layout.tsx
│   ├── ReleaseCard.tsx
│   ├── ReleaseList.tsx
│   ├── SearchBar.tsx
│   ├── SortControls.tsx
│   ├── SelectPill.tsx
│   ├── BrowseToolbar.tsx
│   ├── StatsCard.tsx
│   ├── BatchActionBar.tsx
│   ├── YouTubeButton.tsx
│   └── YouTubeEmbed.tsx
├── pages/                    # Páginas del router
│   ├── Dashboard.tsx
│   ├── Browse.tsx
│   ├── Scraper.tsx
│   ├── History.tsx
│   ├── Stats.tsx
│   └── Settings.tsx
├── App.tsx                   # Router + DataInit (carga adaptadores, restaura stores)
├── main.tsx
└── index.css
api/                           # Funciones serverless (deploy a Vercel)
├── relay.ts                   # Relay CORS: GET ?url= / ?health=1, RELAY_ENABLED
└── tsconfig.json
local_adapters/               # Adaptadores intercambiables (definición JSON + README)
├── <id>.json                 # Definición declarativa (source of truth)
├── <id>-README.md            # Documentación propia de cada adapter
├── <id>-adapter.ts           # LEGACY: adaptadores TS clásicos, mantenidos solo como referencia (obsoletos)
└── shared.ts                     # MUSIC_LINKS compartidos entre adaptadores
```

---

## Types (`src/types/`)

### `release.ts`

```ts
// Tipo legacy (solo lo usan los adaptadores TS antiguos)
interface ScrapedRelease {
  titulo: string        // raw title from listing page
  url_release: string   // absolute URL to release page
  cover_url?: string | null
  descargas: ScrapedDownload[]
}

interface ScrapedDownload {
  host: string
  url: string
}

interface Download {
  host: string
  url: string
}

interface Release {
  id: string            // primary persisted id; user state is keyed by this value
  stableIdentity?: string // optional adapter-provided identity for safer future merges
  source: string        // adapter id that produced the release
  title: string         // original title
  artists: string[]     // parsed from title (before " - " or split)
  album: string         // parsed from title (after " - ")
  label: string         // inferred from catalog or title
  catalog: string       // extracted via regex from download URL
  year: number          // extracted from (YYYY) in title
  genre: string         // extracted from URL path (/techno/, /house/)
  subgenres: string[]
  urlRelease: string
  coverUrl: string | null
  scrapeDate: string    // ISO timestamp of last scrape
  scrapeJobIds: string[]  // IDs of ScrapeJobs that produced this release
  downloads: Download[]
}
```

### `user-state.ts`

```ts
type ListenStatus = 'unlistened' | 'listened' | 'pending' | 'skipped'
type BuyStatus = 'none' | 'bought' | 'wishlist'

interface UserReleaseState {
  id: string            // same as Release.id; preserves favorites/listen state across scrapes
  favorite: boolean
  listenStatus: ListenStatus
  buyStatus: BuyStatus
  notes: string
  tags: string[]
  lastOpened: string | null
  openCount: number
}

// 9 action types:
type HistoryAction =
  | 'opened'             // release opened (title click)
  | 'link_clicked'       // download link or quick-search clicked
  | 'favorited'          // heart toggled on
  | 'unfavorited'        // heart toggled off
  | 'listened'           // mark as listened (manual or YouTube auto-mark)
  | 'unlistened'         // listened toggled off
  | 'scrape_completed'   // scraper finished/cancelled a job
  | 'page_detected'      // page limit detection completed
  | 'batch_action'       // batch bar executed

interface HistoryEntry {
  id?: number            // auto-incremented by Dexie
  releaseId: string
  timestamp: string      // ISO
  action: HistoryAction
  detail?: string        // JSON string for complex actions (scrape, batch, etc.)
}

interface UserSettings {
  id: string
  darkMode: boolean
  itemsPerPage: number
  defaultSort: string
  quickLinks: string[]
  proxyUrl: string
  activeAdapterId: string
  apiKeys: Record<string, string>
}
```

### `scraper.ts`

```ts
interface Genre {
  id: string             // URL slug (e.g. 'techno', 'house')
  label: string          // display name (e.g. 'Techno', 'House')
  path: string           // URL path (e.g. '/techno/')
  query?: string         // query string adicional (p.ej. Internet Archive)
}

interface ScrapeJob {
  id: string
  adapterId: string
  adapterName: string
  genre: Genre
  startPage: number
  endPage: number
  delayPage: number
  delayRelease: number
  status: 'completed' | 'cancelled' | 'error'
  totalReleases: number
  newReleases: number
  updatedReleases: number
  date: string           // ISO timestamp
}

interface ScrapeProgress {
  pagesTotal: number
  pagesDone: number
  releasesFound: number
  releasesScraped: number
  releasesSkipped: number
  currentPage: number
  currentRelease: string
  errors: number
}
```

### `export.ts`

```ts
interface ExportPayload {
  version: 1
  exportedAt: string          // ISO timestamp
  releases: Release[]
  states: UserReleaseState[]
  history: HistoryEntry[]
  jobs: ScrapeJob[]
  settings: UserSettings | null
}
```

### `adapter-definition.ts` — el esquema de los adaptadores JSON

El núcleo del sistema **no-code**: cada `local_adapters/<id>.json` es una `AdapterDefinition` que declara todo lo necesario para scrapear una fuente sin escribir código.

```ts
interface AdapterDefinition {
  version: '1.0'
  id: string                    // unique adapter id (e.g. 'musiceffect')
  name: string
  description?: string
  kind: 'html' | 'api'
  baseUrl: string
  supportsFastSkipExisting?: boolean

  fetch: {
    mode: 'proxy' | 'relay' | 'direct'   // cómo se ejecutan las peticiones (ver §Red)
    relayBase?: string                   // default '/api/relay' — solo modo relay
    timeout?: number                     // ms — solo modo direct
    headers?: Record<string, string>     // solo modo direct
  }

  genres: {
    source: 'hardcoded' | 'dynamic'
    items?: Genre[]            // lista fija de géneros
    dynamicUrl?: string        // si source=dynamic: URL que lista géneros
    dynamicRegex?: string      // regex sobre esa URL (grupos: id, label)
    fallbackItems?: Genre[]    // usados si la carga dinámica falla
  }

  pagination: {
    detection: 'api-count' | 'binary-search' | 'html-last-page' | 'client-side'
    mode: 'page-number' | 'offset' | 'client-side'
    pageSize: number
    maxPagesCap?: number       // tope de seguridad (default 5000)
    countFieldPath?: string    // api-count: campo JSON con el total
    lastPageRegex?: string     // html-last-page: regex para extraer la última página
  }

  scrapeMode: 'single-pass' | 'two-phase'   // ¿fetch de detalle o solo listado?

  api?: {
    countUrlTemplate?: string
    resultsPath?: string
    countFieldPath?: string
    statusFieldPath?: string
    statusSuccessValue?: string
    errorMessagePath?: string
    apiKeyRequired?: boolean
    apiKeyField?: string       // clave en Settings → API Keys
    apiKeyParamName?: string
    errorTranslations?: Array<{ pattern: string; message: string }>
    clientSidePaginationField?: string
  }

  selectors?: {                // kind: 'html'
    listPage: {
      releaseContainer: string
      title: SelectorConfig | string
      urlRelease: SelectorConfig | string
      nextPage?: string
    }
    detailPage?: {
      cover?: SelectorConfig | string
      downloads?: {
        container: string
        linkSelector: string
        hostAttr?: string
        hostStatic?: string
        urlAttr?: string
      }
    }
  }

  urlTemplates: {              // plantillas con {genreId} {page} {offset} {pageSize} {query} {path}
    page: string
    firstPage?: string
    search?: string
  }

  fieldMapping: {
    id?: FieldExtractor
    title?: FieldExtractor
    artists?: FieldExtractor
    album?: FieldExtractor
    label?: FieldExtractor
    catalog?: FieldExtractor
    year?: FieldExtractor
    genre?: FieldExtractor
    subgenres?: FieldExtractor
    coverUrl?: FieldExtractor
    downloads?: DownloadsConfig
    urlRelease?: FieldExtractor
    stableIdentity?: FieldExtractor
  }

  hardcodedFields?: {
    artists?: string[]
    album?: string
    label?: string
    catalog?: string
    coverUrl?: string | null
    genre?: string
    source?: string
  }
}
```

Los **extractores** (`FieldExtractor`) son expresiones declarativas que el engine evalúa por campo:

| `from` | Descripción |
|--------|-------------|
| `selector` | `doc.querySelector(selector)` → atributo o textContent |
| `selectorText` | Igual pero solo textContent |
| `regex` | `rawTitle` o textContent → `pattern` con grupo |
| `sha1` | Hash del `urlRelease`, de un campo (`identifier`) o compuesto (`composite` + `compositeFields`) — genera `id`/`stableIdentity` |
| `titleParse` | Divide título por separador → artists/album/year |
| `urlPath` | Regex sobre la URL con transform `capitalize` |
| `apiField` | Campo del JSON de la API (`data.field`) |
| `hardcoded` | Valor constante |
| `concat` | Concatena campos en un template `{0}`, `{1}`… |
| `substr` | Subcadena de un campo |
| `split` | Divide varios campos por delimitadores → array |

### `adapter.ts` — contrato de adaptador (implementado por el engine)

La interfaz pública sigue siendo `ScraperAdapter`. Ya no la implementa cada fuente manualmente: **el engine la construye a partir de la `AdapterDefinition`** (`createAdapterFromDef`).

```ts
type AdapterKind = 'html' | 'api'

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
  detectMaxPages(genreId: string, options: { proxyUrl: string }, signal?: AbortSignal): Promise<number>
  getSearchLinks(): QuickLink[]
  scrape(options, callbacks, signal, isPaused): Promise<void>
}
```

---

## Servicios (`src/services/`)

### `cors-proxy.ts` — red

Wrapper de fetch para los tres modos de red. Documentado en detalle en [`NETWORK.md`](./NETWORK.md). API real:

```ts
export function isProduction(): boolean            // hostname !== 'localhost'
export function setProxyUrl(url: string): void
export function getProxyUrl(): string
export function isRelayAvailable(): boolean | null
export async function checkRelayHealth(): Promise<boolean>   // GET /api/relay?health=1 (corre en dev y prod)
export async function fetchWithProxy(url, signal?, referer?): Promise<string>
export async function fetchDirectRelay(baseRelay, url, signal?, referer?): Promise<string>
export function parseHtml(html: string): Document
```

- **`fetchWithProxy`** (modo `proxy`): usa `buildFetchUrl()`. Si entorno prod + relay sano + `proxyUrl` vacío → `/api/relay?url=`; si no → `<proxyUrl><target>`.
- **`fetchDirectRelay`** (modo `relay`): construye `<baseRelay>?url=<encoded target>` (añade `&` si el base ya trae query). Siempre a través del relay, ignora el `proxyUrl` de Settings.
- **Timeout**: `FETCH_TIMEOUT_MS = 30_000` vía `withTimeout()` (combina la señal externa con `AbortSignal.timeout`). `isTimeoutError()` hace *fail-fast*: los timeouts **no** se reintentan.
- **Retries**: hasta 3 intentos con backoff (1s·2^n) en errores transitorios (`403`/`429` o error de red), nunca en timeout ni en abort.
- Envía User-Agent (Chrome), Accept, Accept-Language y Referer opcional.

### `adapter-definitions.ts`

```ts
export const adapterDefinitions: AdapterDefinition[]
export function getAdapterDefinition(id: string): AdapterDefinition | undefined
export function getAdapterDefinitionIds(): string[]
```

Carga todos los `local_adapters/*.json` con `import.meta.glob(..., { eager: true })` y valida que tengan `id`.

### `adapter-engine.ts` — el motor

`createAdapterFromDef(def)` devuelve un objeto `ScraperAdapter` funcional. Implementa:

- **`getFetchFunction(def)`** — devuelve el fetch según `def.fetch.mode` (relay → `fetchDirectRelay`, direct → fetch con timeout+headers, proxy → `fetchWithProxy`).
- **Evaluador de extractores** — `evaluateExtractor(extractor, ctx)` ejecuta cada `FieldExtractor` declarado en `fieldMapping`.
- **URLs** — `buildPageUrl` / `buildApiUrl` rellenan `urlTemplates` con `{genreId}`, `{page}`, `{offset}`, `{pageSize}`, `{query}`, `{path}`.
- **Detección de páginas** (ver §Detección) — `api-count`, `binary-search`, `html-last-page`, `client-side`, con caché en `localStorage`.
- **Géneros dinámicos** — si `genres.source === 'dynamic'`, descarga `dynamicUrl` y parsea `dynamicRegex` (p.ej. Incompetech).
- **API keys** — resuelve `useSettingsStore.settings.apiKeys[def.api.apiKeyField]`; si falta y es requerida, lanza error amigable.
- **`scrape()`**:
  - `kind: 'api'` → pide JSON página a página, valida `statusFieldPath`, traduce errores con `errorTranslations`, mapea `resultsPath`.
  - `kind: 'html'` + `scrapeMode: 'two-phase'` → lista + fetch de detalle (downloads/cover); si el detalle falla, degrada a release parcial.
  - `kind: 'html'` + `single-pass` → mapea desde el listado.
  - **Fast skip**: si `options.fastSkipExisting` y el adapter lo soporta, omite detalle para releases ya conocidas.
  - Respeta abort (cancel) y pausa; emite `onProgress`, `onPageDone`, `onReleaseDone`, `onError`, `onComplete`.
- **Transformación** — `mapFieldsFromHtml` / `mapFieldsFromData` construyen el `Release` aplicando `hardcodedFields` + `fieldMapping`.

### `fetch-info.ts` — transporte efectivo para la UI

```ts
interface FetchInfoContext { env: 'dev'|'prod'; relayAvailable: boolean|null; proxyUrl: string }
interface FetchInfo { kind; transport; label; detail; warning? }
export function getFetchInfo(adapterId: string, ctx: FetchInfoContext): FetchInfo
```

Resuelve qué transporte usará realmente un adapter: `direct`, `relay` (Vercel serverless / middleware Vite), `proxy` (custom) o `none` (warning: no hay proxy y el relay no está disponible). Lo consumen Settings (tabla "Active transport per source") y Scraper (badge Transport).

### `release-identity.ts` — merge anti-duplicados

```ts
normalizeReleaseUrl(url): string
getReleaseIdentityCandidates(release): string[]   // stableIdentity, id, identidad textual
buildReleaseIdentityIndex(releases): Map<string, string>
findExistingReleaseId(index, release): string | undefined
```

Genera los candidatos de identidad usados por `releases.ts` para mergear scrapes (por `stableIdentity`, `id`, URL normalizada o clave textual de respaldo).

### `search.ts`

```ts
buildSearchIndex(releases)       // crea índice Fuse.js global
search(query): Release[]         // fuzzy search sobre título, artistas, label, catálogo, álbum
sortReleases(releases, field, dir)  // multi-campo localeCompare
```

- Fuse.js config: `threshold: 0.4`
- Sort fields: `year`, `title`, `label`, `artist`, `catalog`, `scrapeDate`

### `youtube.ts`

```ts
async function searchYouTube(query: string): Promise<string | null>
```

Estrategia en 2 fases:
1. **Fast API** (3s): `yt.lemnoslife.com/noKey/search`
2. **Scrape YouTube** (8s, dos proxies, incl. allorigins): `youtube.com/results` → extrae `ytInitialData` o regex `"videoId":"..."`
3. Hasta 4 variantes de query probadas por release
4. Cache en memoria `Map<string, string | null>`

### `batch-actions.ts`

```ts
type BatchAction = 'download' | 'search' | 'mark-listened' | 'mark-unlistened' | 'mark-favorite' | 'mark-unfavorite'
collectUrls(releases, count, action): UrlEntry[]
getUniqueHosts(releases): string[]
getHostsWithCount(releases, targetHost?): { host, displayName, count }[]
normalizeHostDisplay(host): string
```

- `collectUrls` — URLs a abrir para los modos URL
- `getHostsWithCount` — hosts disponibles sobre el scope efectivo, con display name y conteo
- `normalizeHostDisplay` — normalización visual de nombres de host (sin modificar el dato)

### `links.ts`

```ts
const GLOBAL_LINKS: QuickLink[]        // Google, YouTube, Yandex, DuckDuckGo
registerAdapterLinks(adapterId, links): void
getAdapterLinks(adapterId): QuickLink[]
getAllQuickLinks(adapterId?): QuickLink[]
findAllLinks(): QuickLink[]
findQuickLink(id): QuickLink | undefined
buildSearchQuery(release, link): string
```

- `GLOBAL_LINKS`: siempre mostrados
- Los links musicales específicos viven en `local_adapters/shared.ts` (`MUSIC_LINKS`); el engine los devuelve en `getSearchLinks()`
- `registerAdapterLinks` se llama desde `scraper.store.registerAdapter()`

---

## Stores (`src/stores/`)

### `releases.ts` — Zustand

```ts
interface ReleasesStore {
  releases: Release[]
  filtered: Release[]
  searchQuery: string
  sortField: SortField
  sortDir: SortDir
  filterState: FilterState           // listened, unlistened, favorite, scrapeJobId, source

  initFromDb(): Promise<void>
  loadReleases(data, scrapeJobId?, skipExisting?): MergeResult
  clearAll(): Promise<void>
  setSearchQuery(q: string): void
  setSort(field, dir?): void
  setFilter(partial): void
  selectReleases(criteria): void     // para BatchActionBar
}
```

- **Intelligent merge**: releases existentes reciben nuevos download links (dedup por URL), se añade `scrapeJobId`, se actualiza `scrapeDate`
- **Merge compatible por identidad**: usa `release-identity.ts` — compara por `stableIdentity`, `id`, URL normalizada y clave textual de respaldo
- **Skip updates**: cuando `skipExisting=true`, los releases ya presentes se omiten en el merge final
- **Filters**: filtros combinados en AND (listened, unlistened, favorite, scrapeJobId, source)

### `user-state.ts` — Zustand

```ts
interface UserStateStore {
  states: Record<string, UserReleaseState>
  history: HistoryEntry[]
  loaded: boolean

  loadAllStates(): Promise<void>
  toggleFavorite(id): Promise<void>
  setListenStatus(id, status): Promise<void>
  setBuyStatus(id, status): Promise<void>
  setNotes(id, notes): Promise<void>
  toggleTag(id, tag): Promise<void>
  logAction(releaseId, action, detail?): Promise<void>
  loadHistory(): Promise<void>
  resetAll(): void
}
```

- Cada toggle persiste inmediatamente a IndexedDB
- `loadHistory` con límite de 100 entradas

### `youtube.ts` — Zustand

```ts
interface YouTubeStore {
  activeReleaseId: string | null
  activeVideoId: string | null
  setActive(releaseId, videoId): void
  clearActive(): void
}
```

Coordinación de reproducción inline: solo un video activo a la vez.

### `settings.ts` — Zustand

```ts
interface SettingsStore {
  settings: UserSettings
  loaded: boolean
  load(): Promise<void>
  update(partial: Partial<UserSettings>): Promise<void>
}
```

- Default: `darkMode: true`, `itemsPerPage: 50`, `proxyUrl: 'https://corsproxy.io/?'`
- `load()` aplica `setProxyUrl()`; `update()` lo reaplica si cambia `proxyUrl`
- `apiKeys: Record<string, string>` — claves API dinámicas por adapter, configurables en Settings → API Keys

### `network.ts` — Zustand (reactivo)

```ts
interface NetworkState {
  env: 'dev' | 'prod'
  relayAvailable: boolean | null
  checking: boolean
  check(): Promise<void>
}
```

- `check()` → `isProduction()` + `checkRelayHealth()`
- Inicializado una vez en `App.tsx`; consumido por Settings y Scraper (badge de entorno + estado del relay)

### `scraper.ts` — Zustand (multi-adapter)

```ts
interface ScraperStore {
  adapters: Record<string, ScraperAdapter>
  activeAdapterId: string | null
  adapter: ScraperAdapter | null       // convenience ref
  running, paused: boolean
  progress: ScrapeProgress | null
  results: Release[]
  log: string[]
  currentJobId: string | null
  jobs: ScrapeJob[]

  registerAdapter(a: ScraperAdapter): void
  setActiveAdapter(id: string): void
  detectPages(genreId: string, proxyUrl: string): Promise<number | null>
  start(genre: Genre, options: ScrapeAdapterOptions, autoLoad?: boolean, skipExisting?: boolean): Promise<void>
  pause(): void
  resume(): void
  cancel(): void
  clear(): void
  resetAll(): Promise<void>
  loadJobs(): Promise<void>
}
```

- `registerAdapter`: añade al mapa y llama `registerAdapterLinks(adapter.id, adapter.getSearchLinks())`; activa si es el primero o coincide con `activeAdapterId`
- `detectPages`: delega en `adapter.detectMaxPages()` (que cachea en localStorage); retorna `null` en error
- `start`: crea `ScrapeJob`, llama `adapter.scrape()`; al completar hace auto-merge (según `autoLoad`) y persiste el job
- `cancel`: usa `currentGenre` + `currentOptions` para crear el registro del job
- `resetAll`: limpia cachés de todos los adaptadores, IndexedDB, localStorage y stores; recarga la página
- Jobs persistidos en IndexedDB, cargados en `DataInit`

---

## Componentes (`src/components/`)

### `ThemeProvider.tsx`

- Lee `darkMode` del store settings; sincroniza `data-theme` en `<html>`; actualiza `<meta name="theme-color">` (PWA)

### `Layout.tsx`

- Sidebar fijo (≥lg) / overlay móvil (<lg), Discord-style
- Nav links: Dashboard, Browse, Scraper, History, Stats, Settings
- Badge "Offline" en sidebar cuando no hay conexión (`online`/`offline`)
- `<Outlet />` para contenido de ruta

### `DataInit` (en `App.tsx`)

```ts
loadSettings().then(() => setProxyUrl(...))
useNetworkStore.getState().check()
loadAllAdapters()  // definitions-first, TS legacy como fallback
initFromDb(); loadAllStates(); loadJobs()
```

- **`loadAllAdapters()`**: registra primero todos los `adapterDefinitions` (creando cada adapter con `createAdapterFromDef`); después recorre `local_adapters/*-adapter.ts` y solo registra un TS si su `id` **no** tiene definición JSON (hoy ninguno: los 5 ids tienen `.json` → los TS legacy quedan como código muerto/referencia)
- Restaura `activeAdapterId`; muestra "Loading..." hasta terminar

### `ReleaseCard.tsx`

Layout horizontal compacto:
- Selection checkbox (solo en selection mode); cover 48×48 con fallback `ImageOff`
- Compact summary row + compact actions (favorite/listened)
- Details toggle: title link (`opened`), metadata, downloads (botones por host), quick links (`getAllQuickLinks(release.source)`), YouTube Listen, notes
- Top-right: fav heart + listen check/circle

### `ReleaseList.tsx`

- TanStack Virtual (`measureElement` + `data-index`); resuelve jobs por `scrapeJobIds`; pre-carga estados de los primeros 20 releases

### `SearchBar.tsx` / `SortControls.tsx` / `StatsCard.tsx`

- SearchBar: input con Search + X
- SortControls: select (year/title/label/artist/catalog/scrapeDate) + toggle asc/desc
- StatsCard: `{ title, items: { name, count }[] }`

### `SelectPill.tsx`

Dropdown tipo pill reutilizable (filtros de Browse y SelectPill del BatchActionBar).

### `BrowseToolbar.tsx`

Toolbar de Browse en modo normal, 3 filas (`min-h-28`): Actions + SearchBar + SortControls + Load JSON; filter pills (Listened/Unlistened/Favorite) + SelectPills (Job, Source); fila informativa.

### `BatchActionBar.tsx`

Barra de acciones en 3 filas fijas con `min-h-28`:

**Row 1 (controles)**: `[X (exit)] [Count | Selection toggle] | [Action: ▾] [Target: ▾] [Delay: ▾] [Auto-mark: ▾]`
- Action: 6 modos (download, search, mark-listened, mark-unlistened, mark-favorite, mark-unfavorite)
- Target: plataforma (search) o host (download), "No hosts" si no hay
- Auto-mark: listened/unlistened/favorite/unfavorite en `onEachOpen`

**Row 2 (ejecución)**: `[Count input / N selected] [Reset / Clear] [SelectPill] [progress] [Open N / Stop]`
- SelectPill con criterios: `listened`, `unlistened`, `favorite`, `unfavorite`, `__all__`, o un `jobId`; opciones con count 0 ocultas
- `selectReleases(criteria)` itera sobre `filtered`
- Bugfix: al recargar, si `selectJobId` persiste pero `selectedIds` está vacío, un `useEffect` de montaje lo limpia
- Botón Open/Run muestra `projectedOpenCount` real (tras filtro de host); Stop rojo aborta

**Row 3 (informativa)**: `filterSummary · actionSummary`

Otros:
- `highlightCount` → Browse → ReleaseList (borde azul)
- Filters mandan sobre batch: `setFilter()`/`setSearchQuery()` limpian `selectedIds`
- Estado persistido en localStorage: `batch_action_bar`

### `YouTubeButton.tsx` / `YouTubeEmbed.tsx`

- YouTubeButton: `idle → loading → loaded | error`; 4 queries probadas con `searchYouTube()`; auto-marca `listened` al encontrar; renderiza embed
- YouTubeEmbed: `<iframe>` 16:9 autoplay

---

## Páginas (`src/pages/`)

### `Dashboard.tsx` — ruta `/`

- Stats cards (total, listened, favorites, artists/labels únicos), year range, total download links
- Downloads by host y Clicks by host (desde history), Last scrape job

### `Browse.tsx` — ruta `/browse`

- **BrowseToolbar** (modo normal): Row 1 Actions+SearchBar+SortControls+Load JSON; Row 2 filter pills (Listened/Unlistened/Favorite) + SelectPills (Job, Source) en **AND**; Row 3 info dinámica. Cambiar un filtro invalida la selección batch.
- **BatchActionBar** (modo batch): reemplaza el toolbar
- **ReleaseList** virtualizada con `highlightCount`

### `Scraper.tsx` — ruta `/scraper`

- **Selector de Source** (si hay >1 adapter) + **badge Transport**: muestra el transporte efectivo del adapter activo (Relay `/api/relay` · Proxy host · Directo), resuelto por `getFetchInfo()` — verde/cian, rojo con warning si no hay proxy y el relay no está disponible
- **HTML adapters** (`kind: 'html'`): genre selector + "Detect max pages" (con timestamp del caché), page range (auto-fill desde detección), delays, toggles (auto-load, skip updates, fast skip si aplica)
- **API adapters** (`kind: 'api'`): genre selector, page range sin auto-detección, sin delays/proxy
- **Comunes**: Start/Pause/Resume/Cancel, progress bar, log scrollable, Export JSON + Load into Browser, Recent Jobs (últimos 20)

### `History.tsx` — ruta `/history`

Lista cronológica con action badges y detalle específico por acción; releases no encontradas muestran "(deleted release)".

### `Stats.tsx` — ruta `/stats`

Top 10 artists, labels, years con `StatsCard`.

### `Settings.tsx` — ruta `/settings`

- **Appearance**: dark mode + items per page
- **CORS Proxy**: badge de entorno **DEV (localhost)** / **PROD (Vercel)**; input `proxyUrl`; estado del relay por entorno (checking/available/unavailable) y **tabla "Active transport per source"** con el transporte efectivo de cada adapter cargado (vía `getFetchInfo`)
- **API Keys**: sección dinámica adapter → key (password con 👁️, ✓/×, + Add)
- **Data Management**: 3 resets (All Data, User Data, Scrape Data)
- **Export/Import**: Export All Data (JSON) / Import All Data (valida `version: 1`, replace completo, refresca stores)

---

## Almacenamiento (IndexedDB via Dexie)

### `storage/db.ts`

```ts
const db = new Dexie('SCRP Music')
db.version(3).stores({
  states:   'id, favorite, listenStatus, buyStatus, *tags',
  history:  '++id, releaseId, timestamp, action',
  settings: 'id',
  releases: 'id, year, genre',
  jobs:     'id, date',
})
```

#### Tablas

| Tabla | Key | Propósito |
|-------|-----|-----------|
| `states` | `id` (Release.id) | UserReleaseState por release |
| `history` | `++id` (auto-increment) | HistoryEntry, indexado por timestamp |
| `settings` | `id` ('default') | UserSettings |
| `releases` | `id` (Release.id) | Release[] completo |
| `jobs` | `id` (generado) | ScrapeJob[], indexado por date |

#### Helpers

- CRUD states (`getReleaseState`, `setReleaseState`, `getAllStates`)
- `addHistory`, `getHistory` (limit 100), `getAllHistory`
- `getSettings`, `saveSettings`
- `getAllReleases`, `saveAllReleases` (clear + bulkPut), `clearReleases`
- `clear` (todas las tablas), `clearJobs`, `saveJob`, `getJobs`
- `exportAll` → ExportPayload, `importAll(payload)` → clear + bulkPut (+ `saveSettings`)

#### Caché adicional (localStorage)

- **Page limits**: clave `{adapterId}_page_limits` → `{ [genreId]: { maxPage, detectedAt } }` (gestión del engine)
- **Batch bar**: `batch_action_bar`

---

## Flujo de datos completo

```
App Load
  │
  └─► DataInit
        ├─► settings.load() → setProxyUrl()
        ├─► network.check() → health check relay
        ├─► loadAllAdapters()
        │     ├─► adapterDefinitions (local_adapters/*.json) → createAdapterFromDef() → registerAdapter()
        │     └─► legacy *-adapter.ts (solo si el id NO tiene definición JSON)
        ├─► releases.initFromDb() → db.releases.toArray() → store + Fuse index
        ├─► user-state.loadAllStates() → db.states.toArray()
        └─► scraper.loadJobs() → db.jobs.toArray()

Scrape Flow
  Scraper.tsx
    ├─► scraper.start(genre, options, autoLoad, skipExisting)
    │     ├─► adapter.scrape()  (instancia creada por el engine)
    │     │     ├─► getFetchFunction(def) → relay | proxy | direct (cors-proxy.ts)
    │     │     ├─► buildPageUrl/buildApiUrl → source
    │     │     ├─► HTML: lista → (two-phase) detalle → mapFieldsFromHtml()
    │     │     │       API: JSON → status check → mapFieldsFromData()
    │     │     ├─► callbacks.onProgress / onPageDone / onReleaseDone / onError
    │     │     └─► onComplete(results)
    │     ├─► progress → store → UI (log + bar)
    │     └─► onComplete → loadReleases() → merge (release-identity) + persist + saveJob()
    │
    ├─► detectPages(genreId) → adapter.detectMaxPages() → modo de detección → localStorage cache
    │
    └─► saveJob() → db.jobs.put()

Browse Flow
  Browse.tsx
    ├─► SearchBar → setSearchQuery()
    │       ↓
    │   releases.ts store (search + applyFilters + sort)
    │   filtered[]   ←── única fuente de verdad para lista y batch
    ├─► BrowseToolbar (modo normal, basado en filtered)
    ├─► BatchActionBar (modo batch, reemplaza BrowseToolbar)
    ├─► releases.setFilter() → AND filter (limpia selectedIds al cambiar)
    └─► ReleaseList → ReleaseCard × N (virtualized, con highlightCount)

**Invariante clave:** `filtered` es siempre la única fuente de verdad para la lista y para el BatchActionBar.

Batch Flow
  BatchActionBar (scope = filtered en count mode o selectedIds ∩ filtered en selection mode)
    ├─► getTargetReleases() → slice(0, count) o filter(selectedIds)
    ├─► getHostsWithCount(targetReleases) → hosts con conteo
    ├─► collectUrls(targetReleases, mode, target) → UrlEntry[]
    ├─► openSequentially(entries, delay, autoMark) → solo URL modes
    └─► executeBatchStateAction(targetReleases, mode) → mark ops

Export/Import
  Settings.tsx
    ├─► exportAll() → download JSON
    └─► importAll(payload) → clear DB + bulkPut + refresh stores
```

### Reglas de reset automático (batch)

- Cambio de `searchQuery` o `filterState` → `selectedIds.clear()`
- `clearAll()` → reset de todo
- `target` se auto-resetea al cambiar `mode` o si el host desaparece del scope
- `selectJobId` solo se limpia al cerrar batch mode (X)

---

## Temas (Theming)

### CSS Custom Properties en `index.css`

`[data-theme='light']` / `[data-theme='dark']` definen `--bg-primary/secondary/tertiary`, `--bg-card/hover/input/border`, `--content/-secondary/-muted`, `--border-main/-light`, `--accent/-hover`. Clases utilitarias `.bg-surface*`, `.text-content*`, `.border-border-*`.

- `data-theme` lo aplica `ThemeProvider` en `<html>`. **No se usa la variante `dark:` de Tailwind.**
- `bg-surface-tertiary/50`: regla CSS con `color-mix()` (Tailwind no genera opacidad de variables CSS)

---

## PWA (Progressive Web App)

### Service Worker (Workbox vía `vite-plugin-pwa`)

`generateSW`, `registerType: 'autoUpdate'`, `globPatterns: **/*.{js,css,html,svg,png}`, `navigateFallback: '/'`. El build actual precachea **17 entries (~595 KiB)**.

### Manifest

Generado en `dist/manifest.webmanifest` (`name: "SCRP Music — Release Browser & Scraper"`, `theme_color: #09090b`, `display: standalone`, iconos 192/512).

### Online/Offline

- `Layout.tsx` escucha `online`/`offline` → badge "Offline" en sidebar
- App shell, releases, estado de usuario y búsqueda funcionan offline; scraper, YouTube y fetch CORS requieren red

---

## Principios de arquitectura

1. **Definiciones JSON inmutables** — `local_adapters/*.json` nunca se modifican por el código; son la fuente de verdad transitoria. Se mergea por ID.
2. **Motor declarativo** — Todo el comportamiento específico se expresa en la `AdapterDefinition`; el core y el engine nunca dependen de un sitio concreto.
3. **Separación de capas** — Types / Services / Stores / Components nunca se mezclan.
4. **Estado de usuario separado** — Lo que no está en el JSON origen va a IndexedDB.
5. **Virtualización** — Solo se renderizan items visibles.
6. **Búsqueda instantánea** — Fuse.js indexa en carga, busca en <30ms.
7. **Sin backend (salvo relay opcional)** — 100% client-side; única pieza de servidor: `/api/relay`.
8. **Persistencia reactiva** — Cada cambio relevante persiste inmediatamente a IndexedDB.
9. **Scraper autónomo** — Corre en el navegador, con pausa/cancelación y progreso en tiempo real.
10. **Adaptador intercambiable** — Basta añadir un `<id>.json` (y opcionalmente `<id>-README.md`) para soportar una fuente nueva, sin recompilar.

---

## Adapter Architecture (JSON + engine)

### Loading (auto-discovery)

`App.tsx` registra adaptadores **definitions-first**:

```ts
const modules = import.meta.glob('../../local_adapters/*.json', { eager: true })
// → adapterDefinitions[]
for (const def of adapterDefinitions) {
  useScraperStore.getState().registerAdapter(createAdapterFromDef(def))
}
// fallback: *-adapter.ts solo si el id NO está en adapterDefinitions
```

Los `*-adapter.ts` legacy se mantienen **solo como referencia** (obsoletos): documentan cómo se construía cada fuente antes del motor JSON, pero no se cargan.

### Modes de red (resumen)

| Modo | Qué hace | Cuándo |
|------|----------|--------|
| `relay` | `fetchDirectRelay('/api/relay', url)` → `?url=` | Sitios que bloquean proxies CORS públicos |
| `proxy` | `fetchWithProxy()` → `buildFetchUrl()` | APIs JSON tras un proxy CORS |
| `direct` | fetch plano con timeout/headers | APIs con CORS permisivo |

Ver [`NETWORK.md`](./NETWORK.md) para la regla completa de routing, dev vs prod y health check.

### Detección de páginas

| Modo | Descripción |
|------|-------------|
| `api-count` | 1 request a endpoint de conteo; total desde `countFieldPath` → `ceil(total/pageSize)` |
| `binary-search` | Doblar exponencial + búsqueda binaria hasta página vacía |
| `html-last-page` | 1 request a página 1; escanea HTML con `lastPageRegex` y toma el máximo. Instantáneo, sin 404s de sondeo |
| `client-side` | Sin paginación real: fetch completo y filtro/slice (p.ej. Incompetech) |

Todas cachean en localStorage (`{adapterId}_page_limits`) y respetan `maxPagesCap`.

### API Keys System

`UserSettings.apiKeys: Record<string, string>` (IndexedDB): la clave es `def.api.apiKeyField`, el valor la credencial. UI en Settings → API Keys. El engine la resuelve en `scrape()`/`detectMaxPages()` y lanza error amigable si falta siendo requerida.

### Cómo escribir un adapter JSON

1. Crear `local_adapters/<id>.json` siguiendo `AdapterDefinition` (ver §Types).
2. Elegir `fetch.mode`: `relay` para sitios que bloquean proxies CORS; `proxy` para APIs JSON; `direct` solo para APIs con CORS permisivo.
3. En modo relay usar `fetch.relayBase: "/api/relay"`. Si el sitio expone su última página en el paginador HTML, preferir `pagination.detection: "html-last-page"` + `lastPageRegex` sobre `binary-search`.
4. Declarar `genres` (hardcoded o dynamic), `urlTemplates` y `fieldMapping` (extractores).
5. Para HTML: `selectors.listPage` (+ `detailPage` si `scrapeMode: 'two-phase'`); para API: `api.resultsPath` y, si hay paginación, `api.countUrlTemplate`/`countFieldPath`.
6. `hardcodedFields.source` = id del adapter; `stableIdentity` recomendado (p.ej. `sha1` de `urlRelease`).
7. Reiniciar `npm run dev`: se auto-registra. Opcional: `local_adapters/<id>-README.md`.

---

## CORS Proxy / Relay

- **Producción (Vercel)**: `api/relay.ts` (serverless) — GET-only, `?url=` para fetch upstream (15s timeout, Chrome UA, status + content-type, `Cache-Control: s-maxage=60, stale-while-revalidate`), `?health=1` para el health check, `RELAY_ENABLED=false` → 503.
- **Dev**: middleware `relayDevPlugin` en `vite.config.ts` replica la misma ruta `/api/relay` en `npm run dev`.
- **Health check**: `checkRelayHealth()` corre en dev y prod; estado expuesto en `stores/network.ts` y visible en Settings/Scraper.
- **Regla de routing** (`buildFetchUrl`): relay solo cuando `isProduction() && relayAvailable && !proxyUrl`; con el `proxyUrl` por defecto (corsproxy.io) los adapters `proxy` siempre usan el proxy configurado.
- Los adapters `relay` **ignoran** el `proxyUrl` de Settings — siempre van por `/api/relay`.

Referencias: [`NETWORK.md`](./NETWORK.md) (detalle de red) y [`doc_deploy_relay.md`](./doc_deploy_relay.md) (deploy y costos).

---

## Scripts

```bash
npm run dev       # Vite dev server (HMR)
npm run build     # tsc -b && vite build
npm run preview   # Vite preview (producción)
npm run lint      # Oxlint
```

---

## Dependencias

| Paquete                    | Versión | Propósito                    |
| -------------------------- | ------- | ---------------------------- |
| react                      | ^19     | UI framework                 |
| react-dom                  | ^19     | DOM renderer                 |
| react-router-dom           | ^7      | SPA routing                  |
| zustand                    | ^5      | Estado global                |
| dexie                      | ^4      | IndexedDB wrapper            |
| fuse.js                    | ^7      | Fuzzy search                 |
| @tanstack/react-virtual    | ^3      | Virtualized list             |
| tailwindcss                | ^4      | CSS utility-first            |
| @tailwindcss/vite          | ^4      | TailwindCSS Vite plugin      |
| lucide-react               | ^1      | Iconos SVG                   |
| typescript                 | ^6      | Type system                  |
| vite                       | ^8      | Bundler + dev server         |
| @vitejs/plugin-react       | ^4      | React integration            |
| oxlint                     | ^0.x    | Linter                       |
| vite-plugin-pwa            | ^1      | PWA manifest + service worker |
