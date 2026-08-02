# Arquitectura — SCRP Music

## Visión general

SPA (Single Page Application) para navegar, buscar y gestionar releases musicales provenientes de scraping via un sistema de adaptadores. Sin backend. El JSON del scraper no se modifica nunca. El estado de usuario (favoritos, escuchados, historial, notas) y los releases scrapeados se almacenan en IndexedDB vía Dexie y persisten entre recargas.

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
| Proxy CORS       | corsproxy.io / allorigins.win + Vite relay (`/api/*-relay`) |

---

## Estructura del proyecto

```
src/
├── types/                    # Interfaces del modelo de datos
│   ├── adapter.ts                # ScraperAdapter interface (contrato del adaptador)
│   ├── release.ts                # Release, Download
│   ├── user-state.ts             # UserReleaseState, HistoryEntry, UserSettings
│   ├── scraper.ts                # ScrapeJob, ScrapeProgress, Genre
│   ├── links.ts                  # QuickLink interface
│   └── export.ts                 # ExportPayload (para export/import global)
├── services/                 # Lógica pura (sin React) — agnóstica del origen
│   ├── search.ts                 # Índice Fuse.js + sort + filter
│   ├── cors-proxy.ts             # Proxy CORS genérico con fallback + relay directo
│   ├── youtube.ts                # Búsqueda YouTube (API + scraping)
│   ├── batch-actions.ts          # Apertura secuencial de tabs + batch state ops
│   └── links.ts                  # GLOBAL_LINKS, ADAPTER_LINKS registry, buildSearchQuery
├── storage/                  # Capa IndexedDB
│   └── db.ts                     # Dexie schema v3 + helpers CRUD + export/import
├── stores/                   # Estado global (Zustand)
│   ├── releases.ts               # Releases store (carga, merge, búsqueda, filtros)
│   ├── user-state.ts             # Favoritos, listen, history, notes
│   ├── settings.ts               # Modo oscuro, items per page, proxy URL
│   ├── scraper.ts                # Scraper state (adapter-aware, jobs, progreso, log)
│   └── youtube.ts                # Coordinación de reproducción YouTube entre releases
├── components/               # Componentes reutilizables
│   ├── ThemeProvider.tsx
│   ├── Layout.tsx
│   ├── ReleaseCard.tsx
│   ├── ReleaseList.tsx
│   ├── SearchBar.tsx
│   ├── SortControls.tsx
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
├── App.tsx                   # Router + DataInit (carga adaptador, restaura stores)
├── main.tsx
└── index.css
local_adapters/               # Adaptadores intercambiables (un archivo por fuente)
├── *-adapter.ts              # Adaptadores (uno por fuente)
└── shared.ts                     # MUSIC_LINKS compartidos entre adaptadores
```

---

## Types (`src/types/`)

### `release.ts`

```ts
interface Download {
  host: string          // e.g. "Nitroflare", "Mixdrop"
  url: string           // full URL to the file
}

interface ScrapedRelease {
  titulo: string        // raw title from listing page
  url_release: string   // absolute URL to release page
  cover_url?: string | null  // full URL to cover image
  descargas: ScrapedDownload[]
}

interface ScrapedDownload {
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

---

## Servicios (`src/services/`)

### `cors-proxy.ts`

Wrapper de fetch para evitar CORS en peticiones cross-origin.

```ts
async function fetchWithProxy(
  targetUrl: string,
  config?: Partial<ProxyConfig>,
  signal?: AbortSignal
): Promise<Response>

async function fetchDirectRelay(
  relayBase: string,
  path: string,
  config?: Partial<ProxyConfig>,
  signal?: AbortSignal
): Promise<Response>
```

- `fetchWithProxy`: concatena `proxyUrl + encodeURIComponent(targetUrl)`; si el proxy devuelve error, reintenta con `allorigins.win` como fallback automático. Timeout configurable vía `AbortSignal.timeout()`. Envía User-Agent, Accept, Accept-Language y Referer opcional.
- `fetchDirectRelay`: para sitios donde el proxy CORS no funciona (bloquea 403). Usa un relay Vite (`/api/*-relay`) que reenvía headers del navegador directamente al target. Útil cuando corsproxy.io no reenvía headers suficientes.
- Usados por los adaptadores según necesidad (cada adaptador elige el método apropiado)

---

### Scraper logic (in adapter, not in core)

The core no longer contains site-specific scraper logic. All parsing, extraction, and page detection is delegated to an adapter that implements the `ScraperAdapter` interface (defined in `types/adapter.ts`):

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

The adapter is responsible for:
- **Page list parsing**: extracting release URLs, titles, and cover thumbnails from a listing page
- **Download link extraction**: fetching individual release pages and extracting download URLs
- **Cover URL extraction**: finding the cover image via site-specific patterns
- **Title → Release transformation**: generating/preserving release IDs and optional stable identities, parsing artists/album/label/catalog/year
- **Page limit detection**: exponential doubling + binary search (for HTML adapters; API adapters may use a single count call)
- **Optional fast skip**: adapters that can identify a release from the listing page may skip fetching known detail pages when `fastSkipExisting` is enabled

The core (`stores/scraper.ts`) calls `adapter.scrape()`, which returns already-transformed `Release[]` objects via `callbacks.onReleaseDone()`. The core only handles job lifecycle, progress UI, and persistence — it never sees raw HTML or `ScrapedRelease[]`.

---

### Release transformation (in adapter, not in core)

The adapter owns the full `ScrapedRelease → Release` transformation. The core `releases.ts` store accepts `Release[]` directly (already transformed):

| Campo `Release` | Responsabilidad |
| --------------- | --------------- |
| `id` | ID primario generado por el adapter; se conserva para no romper estado de usuario |
| `stableIdentity` | Identidad opcional más robusta para detectar duplicados entre scrapes |
| `source` | ID del adapter que produjo la release |
| `title`, `artists`, `album`, `label`, `catalog`, `year` | Parseado por el adapter |
| `genre` | Asignado por el adapter según el género seleccionado |
| `urlRelease`, `coverUrl`, `downloads` | Extraídos por el adapter |

The core appends `scrapeJobId` after receiving releases via `loadReleases()`. Adapters should leave `scrapeJobIds` empty unless they are importing data that already contains job metadata.

---

### `search.ts`

```ts
buildSearchIndex(releases)       // crea índice Fuse.js global
search(query): Release[]         // fuzzy search sobre título, artistas, label, catálogo, álbum
sortReleases(releases, field, dir)  // multi-campo localeCompare
```

- Fuse.js config: `threshold: 0.4`
- Sort fields: `year`, `title`, `label`, `artist`, `catalog`, `scrapeDate`

---

### `youtube.ts`

```ts
async function searchYouTube(query: string): Promise<string | null>
```

Estrategia en 2 fases:
1. **Fast API** (3s): `yt.lemnoslife.com/noKey/search`
2. **Scrape YouTube** (8s, dos proxies): `youtube.com/results` → extrae `ytInitialData` o regex `"videoId":"..."`
3. Hasta 4 variantes de query probadas por release (artist+title, artist+title sin paréntesis, title, title sin paréntesis)
4. Cache en memoria `Map<string, string | null>`

---

### `batch-actions.ts`

```ts
function collectUrls(releases, mode, target): UrlEntry[]     // 6 modos
function getHostsWithCount(releases): { host, displayName, count }[]
function normalizeHostDisplay(host: string): string           // display-only normalization
function openSequentially(entries, delay, onEachOpen?): Promise<void>
function executeBatchStateAction(releases, mode): void         // mark ops
```

- **6 modos**: `download`, `search`, `mark-listened`, `mark-unlistened`, `mark-favorite`, `mark-unfavorite`
- `UrlEntry: { url: string, releaseId: string }`
- `openSequentially`: abre tabs blank sincrónicamente (anti-popup), navega con `location.href` + delay
- `onEachOpen(releaseId)`: callback opcional para auto-mark (listened, unlistened, favorite, unfavorite)
- Modos mark son instantáneos (sin URLs, sin delay)
- `getHostsWithCount()`: calcula hosts disponibles sobre el scope efectivo, con display name y conteo
- `normalizeHostDisplay()`: normalización visual de nombres de host (sin modificar el dato almacenado)

---

### `links.ts`

```ts
const GLOBAL_LINKS: QuickLink[]        // 4 plataformas universales (Google, YT, Yandex, DDG)
const ADAPTER_LINKS: Map<string, QuickLink[]>  // registro por adapter id

registerAdapterLinks(id: string, links: QuickLink[]): void
getAllQuickLinks(source?: string): QuickLink[]  // globales + específicos del source
findAllLinks(urls: string[]): QuickLink[]
findQuickLink(id: string): QuickLink | undefined
buildSearchQuery(release: Release, link: QuickLink): string  // template replacement
```

- `GLOBAL_LINKS`: siempre mostrados (Google, YouTube, Yandex, DuckDuckGo)
- `ADAPTER_LINKS`: registrados por cada adaptador vía `registerAdapterLinks()` al iniciar
- `registerAdapterLinks()` se llama desde `scraper.store.registerAdapter()` cuando el adaptador implementa `getSearchLinks()`
- `getAllQuickLinks(source?)`: retorna globales + los del source si existe; usado por `ReleaseCard` para mostrar links por release
- `buildSearchQuery()`: reemplaza templates `{title}`, `{artist}`, etc. con datos del release
- Los links musicales específicos viven en `local_adapters/shared.ts` (`MUSIC_LINKS`), compartidos entre adaptadores

---

## Stores (`src/stores/`)

### `releases.ts` — Zustand

```ts
interface ReleasesStore {
  releases: Release[]        // todas
  filtered: Release[]        // después de search + sort + filter
  searchQuery: string
  sortField: SortField
  sortDir: SortDir
  filterState: FilterState   // listened, unlistened, favorite, scrapeJobId

  initFromDb(): Promise<void>              // restore from IndexedDB on mount
  loadReleases(data, scrapeJobId?, skipExisting?): MergeResult  // transform + merge + persist
  clearAll(): Promise<void>
  setSearchQuery(q: string): void
  setSort(field, dir?): void
  setFilter(partial): void
}
```

- **Intelligent merge**: releases existentes reciben nuevos download links (dedup por URL), se añade `scrapeJobId`, se actualiza `scrapeDate`
- **Merge compatible por identidad**: compara por `id`, `stableIdentity`, URL original, URL normalizada y clave textual de respaldo
- **Skip updates**: cuando `skipExisting=true`, los releases ya presentes en IndexedDB se omiten en el merge final (solo se añaden nuevos)
- **Filters**: 4 filtros combinados en AND (listened, unlistened, favorite, scrapeJobId)
- Auto-persiste a IndexedDB tras `loadReleases()`

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

- Cada toggle persiste inmediatamente a IndexedDB y actualiza memoria
- `loadAllStates` se llama desde `DataInit` al montar
- `loadHistory` con límite de 100 entradas
- `resetAll`: limpia estados e historial en memoria

### `youtube.ts` — Zustand

```ts
interface YouTubeStore {
  activeReleaseId: string | null   // release que tiene el video reproduciéndose
  activeVideoId: string | null     // videoId de YouTube activo
  setActive(releaseId: string, videoId: string): void
  clearActive(): void
}
```

- Coordina la reproducción inline de YouTube entre múltiples releases
- Cuando un release inicia reproducción via `setActive()`, los demás `YouTubeButton` suscriptos al store se cierran automáticamente (solo un video activo a la vez)
- `clearActive()` se llama al desmontar el embed o al cerrar manualmente

### `settings.ts` — Zustand

```ts
interface SettingsStore {
  settings: UserSettings
  update(partial): void
}
```

- `darkMode` sincronizado con `data-theme` en `<html>`
- Persiste a IndexedDB en cada cambio
- **`apiKeys: Record<string, string>`** — claves API dinámicas por adapter (p.ej. `{ myAdapter: "client_id" }`). Configurables en Settings → API Keys (inputs inline, eye toggle, + Add / × Remove). Sin hardcoding — el usuario asocia adapter name → key.

### `scraper.ts` — Zustand (multi-adapter)

```ts
interface ScraperStore {
  adapters: Record<string, ScraperAdapter>
  activeAdapterId: string | null
  adapter: ScraperAdapter | null       // convenience ref to current active
  running, paused: boolean
  currentGenre: Genre | null
  currentOptions: ScrapeAdapterOptions | null
  progress: ScrapeProgress | null
  results: Release[]
  log: string[]
  currentJobId: string | null
  jobs: ScrapeJob[]

  registerAdapter(a: ScraperAdapter): void
  setActiveAdapter(id: string): void
  detectPages(genreId: string, proxyUrl: string): Promise<number | null>
  start(genre: Genre, options: ScrapeAdapterOptions, autoLoad?: boolean): Promise<void>
  pause(): void
  resume(): void
  cancel(): void
  clear(): void
  resetAll(): Promise<void>
  loadJobs(): Promise<void>
}
```

- `registerAdapter`: añade el adaptador al mapa `adapters[id]` y llama `registerAdapterLinks(adapter.id, adapter.getSearchLinks())` si el adaptador implementa `getSearchLinks()`. Si es el primero o coincide con el `activeAdapterId`, lo activa automáticamente
- `setActiveAdapter`: cambia el adaptador activo, limpia estado de scraping (progreso, resultados, log) pero **no** los datos guardados
- `detectPages`: llama a `adapter.detectMaxPages()` y retorna el máximo (o `null` en error). No cachea nada en el store — la caché es responsabilidad del adaptador via `localStorage`
- `start`: crea `ScrapeJob` (con `adapterId`), llama `adapter.scrape()`, al completar auto-mergea a releases store
- `cancel`: usa `currentGenre` + `currentOptions` almacenados para crear el registro del job
- `resetAll`: limpia la caché de todos los adaptadores registrados, IndexedDB, localStorage, stores en memoria y recarga página
- Jobs persistidos en IndexedDB, cargados en `DataInit`
- No hay `detectedPages`, `setGenre`, `setStartPage`, etc. — esos son estado local de la UI o consulta directa al adaptador

---

## Componentes (`src/components/`)

### `ThemeProvider.tsx`

- Lee `darkMode` del store settings
- Sincroniza `document.documentElement.dataset.theme = 'dark' | 'light'`
- Actualiza `<meta name="theme-color">` según el tema (para PWA)

### `Layout.tsx`

- Sidebar fijo (≥lg) / overlay móvil (<lg):
  - Desktop: `<aside>` fijo a izquierda, 224px
  - Mobile: hamburger → overlay + sidebar absoluto, Discord-style
- Nav links: Dashboard, Browse, Scraper, History, Stats, Settings
- Badge "Offline" en sidebar (junto al título) cuando no hay conexión, detectado via `window.addEventListener('online'/'offline')`
- `<Outlet />` para contenido de ruta

### `DataInit` (en `App.tsx`)

- Se monta al inicio
- `loadAllAdapters()` via `import.meta.glob('../local_adapters/*-adapter.ts')` — descubre todos los adaptadores automáticamente
- Cada adaptador se registra via `registerAdapter()` en el scraper store (que también llama `registerAdapterLinks(adapter.id, adapter.getSearchLinks())` si el adaptador implementa el método)
- Restaura `activeAdapterId` desde settings; si no coincide, activa el primero
- Restaura `proxyUrl` desde settings store y la aplica via `setProxyUrl()`
- Llama `initFromDb()`, `loadAllStates()`, `loadJobs()`
- Muestra "Loading..." hasta que `initialized === true` y los adaptadores están cargados

### `ReleaseCard.tsx`

Props: `release, state?, selected?, selectionMode?, checkSelected?, onToggleSelection?, jobs?`

Layout horizontal compacto:
- **Selection checkbox** (solo en selection mode)
- **Cover** 48×48 thumbnail (con `onError` → `ImageOff`)
- **Compact summary row**: muestra una línea con metadata completa del release en vez del h3 largo
- **Compact actions**: favorite/unfavorite y listened/unlistened permanecen visibles en la vista compacta
- **Details toggle**: al expandirse, muestra el mismo contenido que la card full (title, metadata, downloads, quick links, YouTube, notes)
- **Title inside expanded block**: link → abre `urlRelease`, loggea `opened`
- **Downloads**: todos los links (botones por host)
- **Quick links**: botones de búsqueda — 4 globales (Google, YouTube, Yandex, DuckDuckGo) + plataformas musicales del adaptador (via `getAllQuickLinks(release.source)`)
- **YouTube Listen**: botón que busca y reproduce inline
- **Notes**: si existen, se muestran en itálica
- **Top-right**: fav heart + listen check/circle, cada uno loggea

### `ReleaseList.tsx`

Props: `releases, highlightCount?, selectionMode?, selectedIds?, onToggleSelection?`

- TanStack Virtual con `measureElement` + `data-index`
- Resuelve jobs del scraper store por `scrapeJobIds` y los pasa a cada ReleaseCard
- Pre-carga estados de usuario para primeros 20 releases

### `SearchBar.tsx`

Props: `{ query, setQuery }`

- Input con Search icon + X para limpiar

### `SortControls.tsx`

Props: `{ sortField, sortDir, setSort, sortFields? }`

- Select con campos: year, title, label, artist, catalog, scrape date
- Toggle asc/desc

### `StatsCard.tsx`

Props: `{ title, items: { name, count }[] }`

### `BatchActionBar.tsx`

Barra de acciones en 3 filas fijas con `min-h-28`:

**Row 1 (controles)**: `[X (exit)] [Count | Selection toggle] | [Action: ▾] [Target: ▾] [Delay: ▾] [Auto-mark: ▾]`
- Count/Selection: toggle entre modo count (N releases) y selection (checkboxes)
- Action: 6 modos (download, search, mark-listened, mark-unlistened, mark-favorite, mark-unfavorite)
- Target: select de plataforma (search) o host (download), con "No hosts" si no hay releases disponibles
- Delay: ms entre aperturas de tabs (solo URL modes)
- Auto-mark: dropdown único (listened, unlistened, favorite, unfavorite) — se ejecuta en `onEachOpen` callback
- Todos los elementos interactivos usan `py-1.5` para altura consistente
- Host target auto-resetea si el filtro actual elimina ese host

**Row 2 (ejecución)**: `[Count input / N selected] [Reset / Clear] [SelectPill] [progress] [Open N / Stop]`
- Count mode: input numérico + Reset button
- Selection mode: "N selected" label + Clear button + SelectPill con opciones dinámicas:
  - Status: `listened`, `unlistened`, `favorite`, `unfavorite` — cada una con conteo sobre releases filtrados
  - `__all__`: "All releases" (todas las filtradas)
  - Jobs específicos (por `scrapeJobId`)
  - Las opciones con count = 0 se ocultan para no sugerir selecciones que quedarían vacías
- `selectReleases(criteria)` en releases store: itera sobre `filtered` y selecciona según el criterio (`listened`, `unlistened`, `favorite`, `unfavorite`, `__all__`, o `jobId`)
- Bugfix: al recargar página, si `selectJobId` persiste en localStorage pero `selectedIds` está vacío (p.ej. por filtros que excluyen todo), un `useEffect` de montaje lo limpia automáticamente
- Botón Open/Run: muestra `projectedOpenCount` real (tras aplicar filtro de host)
- Botón Stop: rojo, aborta el controller
- Al cerrar (X) se resetea `selectJobId` a `""` y se persiste

**Row 3 (informativa)**: `filterSummary · actionSummary` (o fallback _"Select releases above or use the job selector"_ si no hay)
- `filterSummary`: muestra filtros activos + scope (e.g. "Showing first 50 of 200 matching: techno, source: adapterId")
- `actionSummary`: muestra configuración batch (e.g. "Action: Download from Nitroflare | Count: 50 | Delay: 1500ms | Auto-mark: listened")

Otros:
- `highlightCount` se pasa hacia arriba → `BrowseToolbar` → `Browse.tsx` → `ReleaseList` para borde azul en cards
- Filters mandan sobre batch: `setFilter()` y `setSearchQuery()` en releases store limpian `selectedIds`
- Estado persistido en localStorage: `batch_action_bar`

### `YouTubeButton.tsx`

Props: `{ release }`

States: `idle → loading → loaded | error`

- Genera 4 queries, prueba cada una con `searchYouTube()` hasta encontrar video
- Auto-marca como `listened` al encontrar
- Renderiza `YouTubeEmbed` si cargado

### `YouTubeEmbed.tsx`

Props: `{ videoId }`

- `<iframe>` 16:9 con autoplay, modestbranding

---

## Páginas (`src/pages/`)

### `Dashboard.tsx` — ruta `/`

- **Stats cards**: total releases, listened, favorites, artists únicos, labels únicos
- **Year range** (min/max año entre releases)
- **Total download links** count
- **Downloads by host**: bar chart con hosts y su conteo de links
- **Clicks by host**: bar chart con hosts clickeados (desde history)
- **Last scrape job**: card con género, páginas, fecha, +N/updated counts

### `Browse.tsx` — ruta `/browse`

**BrowseToolbar** (modo normal, 3 filas, `min-h-28`):
- **Row 1**: `[Actions (icono)] [SearchBar] [SortControls] [Load JSON]` — todos `py-1.5`
- **Row 2**: Filter pills + SelectPills:

  | Pill | Icono | Filtro |
  |---|---|---|
  | Listened | `CheckCircle` (verde) | `filterState.listened` |
  | Unlistened | `Circle` (ámbar) | `filterState.unlistened` |
  | Favorite | `Heart` (rojo fill) | `filterState.favorite` |
  | Job | SelectPill | `filterState.scrapeJobId` — filtra por scrape job |
  | Source | SelectPill | `filterState.source` — filtra por adapter de origen |

  Todos los filtros se combinan en **AND**. Cambiar cualquier filtro invalida la selección batch (`selectedIds.clear()`).
- **Row 3**: Info text dinámico: `"15 of 200 releases matching: techno, source: adapterId..."`

**BatchActionBar** (modo batch, reemplaza BrowseToolbar):
- 3 filas: controles / ejecución + selección / información dinámica
- `highlightCount` → blue border en ReleaseCard via `Browse.tsx` state

**ReleaseList** virtualizada con TanStack Virtual + `highlightCount` prop
- Selection mode persistido en localStorage

### `Scraper.tsx` — ruta `/scraper`

UI condicional según `adapter.kind`:

**HTML adapters** (`kind: 'html'`):
- **Genre selector** + "Detect max pages" button con timestamp
- **Page range** inputs (start/end), auto-fill desde detección
- **Delays**: per-page, per-release
- **Proxy URL** editable
- **Auto-load toggle**: carga resultados automáticamente al completar
- **Skip updates for existing releases**: evita actualizar releases ya guardados durante el merge final
- **Fast skip existing release pages**: aparece solo si el adapter declara `supportsFastSkipExisting`; evita fetches de detalle para releases ya conocidas

**API adapters** (`kind: 'api'`):
- **Genre selector** (dropdown con tags válidos del adapter)
- **Page range** inputs (start/end) — sin auto-detección, el usuario define cuántas páginas
- **Sin delays, sin proxy** — hint informativo
- **Auto-load / Skip updates** igual que HTML
- **Sin fast skip de detalle** salvo que un adapter API declare soporte explícito

Comunes:
- **Start/Pause/Resume/Cancel** buttons
- **Progress bar** + release actual + errores
- **Log** (scrollable, time-stamped)
- **Export JSON** + **Load into Browser** buttons
- **Recent Jobs** section (últimos 20, muestra +N new/updated, estado)
- **Clear** button (limpia resultados y log)
- **Recent Jobs** section (últimos 20, muestra +N new/updated, estado)
- **Clear** button (limpia resultados y log)

### `History.tsx` — ruta `/history`

- Lista cronológica (más reciente primero)
- Cada entrada: timestamp, action badge, detalle específico:
  - `opened`: título + link externo
  - `link_clicked`: título + host o search engine
  - `favorited`/`unfavorited`/`listened`/`unlistened`: título
  - `scrape_completed`: género, páginas, releases, estado (completed/cancelled)
  - `page_detected`: género, max pages detectado
  - `batch_action`: count, modo (6 labels), target, +listened badge
- Releases no encontradas muestran "(deleted release)"

### `Stats.tsx` — ruta `/stats`

- Top 10 artists, labels, years con `StatsCard`

### `Settings.tsx` — ruta `/settings`

- **Dark mode** toggle
- **Items per page** select
- **API Keys** dinámicas: sección para asociar adapter name → API key (inline inputs: Adapter name, API key (password con 👁️ toggle), botones ✓/×, + Add new). Sin campos hardcodeados — el usuario define qué adapter usa qué key.
- **3 Reset buttons**:
  - Reset All Data 🔴 — releases + user data + jobs + localStorage → recarga
  - Reset User Data 🟠 — favorites/listened/history/jobs, releases intactas
  - Reset Scrape Data 🟡 — releases + jobs, favorites/history intactos
- **Export/Import**:
  - Export All Data → descarga `sccrp-muzic-export-YYYY-MM-DD.json`
  - Import All Data → file picker, valida `version: 1`, replace completo, refresca stores

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

- `getReleaseState`, `setReleaseState`, `getAllStates` — CRUD states
- `addHistory`, `getHistory` (limit 100), `getAllHistory` (sin límite)
- `getSettings`, `saveSettings`
- `getAllReleases`, `saveAllReleases` (clear + bulkPut), `clearReleases`
- `clear` (todas las tablas), `clearJobs`
- `saveJob`, `getJobs`
- `exportAll` → ExportPayload, `importAll(payload)` → clear + bulkPut

### Flujo de persistencia

1. **App load**: `DataInit` → `getAllReleases()` + `getAllStates()` + `getJobs()`
2. **Scrape**: scraper store → `loadReleases()` → merge + `saveAllReleases()` + `saveJob()`
3. **User action**: cada toggle/note → `setReleaseState()`, cada click → `addHistory()`
4. **Settings**: cada cambio → `saveSettings()`
5. **Export/Import**: `exportAll()` / `importAll(path)`

---

## Flujo de datos completo

```
App Load
  │
  └─► DataInit
        ├─► releases.initFromDb() → db.releases.toArray() → store + Fuse index
        ├─► user-state.loadAllStates() → db.states.toArray()
        └─► scraper.loadJobs() → db.jobs.toArray()

Scrape Flow
  Scraper.tsx
    ├─► scraper.start(genre, options, autoLoad)
    │     ├─► adapter.scrape() → adapter internals
    │     │     ├─► cors-proxy.fetchWithProxy() o fetchDirectRelay() → source website
    │     │     ├─► parse listing + downloads + cover
    │     │     ├─► transform to Release[]
    │     │     └─► callbacks.onRelease() each
    │     ├─► progress → store → UI (log + bar)
    │     ├─► registerAdapterLinks() on adapter init
    │     └─► onComplete → loadReleases() → merge + persist
    │
    ├─► detectPages() → adapter.detectMaxPages() → localStorage cache
    │
    └─► saveJob() → db.jobs.put()

Browse Flow
  Browse.tsx
    ├─► SearchBar → setSearchQuery()
    │       ↓
    │   releases.ts store
    │       ↓ (search + applyFilters + sort)
    │   filtered[]   ←── única fuente de verdad para lista y batch
    │       ↓
    ├─► BrowseToolbar (modo normal, basado en filtered)
    │     ├─► Row 1: Actions (icono) + SearchBar + SortControls + Load JSON
    │     ├─► Row 2: Filter pills (Listened/Unlistened/Favorite) + SelectPills (scrapeJob, source)
    │     └─► Row 3: Info text "N of M releases matching: ..."
    ├─► BatchActionBar (modo batch, reemplaza BrowseToolbar, releases={filtered})
    │     ├─► Row 1: X + Count/Selection toggle + Action/Target/Delay/Auto-mark
    │     ├─► Row 2: Count input / N selected + Reset/Clear + SelectPill (selectReleases) + Open N / Stop
    │     └─► Row 3: filterSummary · actionSummary (o fallback si no hay selección)
    ├─► releases.setFilter() → AND filter (limpia selectedIds al cambiar, resetea target si host desaparece)
    ├─► releases.setSearchQuery() → limpia selectedIds
    ├─► releases.setSort() → sort
    └─► ReleaseList → ReleaseCard × N (virtualized, con highlightCount)

**Invariante clave:** `filtered` es siempre la única fuente de verdad para lo que se muestra en la lista y para lo que procesa el BatchActionBar. No existe un "subset separado" en el BatchActionBar.

Batch Flow
  BatchActionBar (scope = filtered en count mode o selectedIds ∩ filtered en selection mode)
    ├─► getTargetReleases() → slice(0, count) o filter(selectedIds)
    ├─► getHostsWithCount(targetReleases) → hosts disponibles con conteo
    ├─► projectedOpenCount → texto en botón Open/Run
    ├─► collectUrls(targetReleases, mode, target) → UrlEntry[]
    ├─► openSequentially(entries, delay, autoMark callback) → solo URL modes
    └─► executeBatchStateAction(targetReleases, mode) → mark ops (sin URLs ni delay)

  ### Count mode
  - Usuario fija N en input de Row 2
  - Procesa `filtered.slice(0, count)` — primeros N releases filtrados
  - `projectedOpenCount`: URLs reales a abrir tras aplicar filtro de host (si download mode)
  - `highlightCount`: N, pasa a ReleaseCard para borde azul en cards

  ### Selection mode
  - Usuario marca checkboxes en ReleaseList
  - IDs en `selectedIds` (store global); batch procesa `selectedIds ∩ filtered`
  - `projectedOpenCount`: releases seleccionadas con el host target
  - `highlightCount`: `selectedIds.size`

  ### selectReleases (SelectPill en Row 2)
  - Criterios: `listened`, `unlistened`, `favorite`, `unfavorite` (status con conteo dinámico), `__all__` (todas filtradas), o un `jobId` específico
  - Opciones con count = 0 se ocultan para evitar selecciones que quedarían vacías
  - `selectReleases(criteria)` en releases store itera sobre `filtered`
  - Bugfix: al recargar, si `selectJobId` persiste pero `selectedIds` está vacío, un `useEffect` de montaje lo limpia

  ### Modos de acción

  | Modo | Qué hace |
  |---|---|
  | `download` | Abre tab con URL de descarga del host seleccionado por cada release |
  | `search` | Abre tab de búsqueda (Google, Beatport, etc.) con metadatos del release |
  | `mark-listened` | Marca como listened las releases del scope |
  | `mark-unlistened` | Marca como unlistened |
  | `mark-favorite` | Marca como favorito |
  | `mark-unfavorite` | Quita favorito |

  ### autoMark (solo modos URL)
  - Dropdown único: listened, unlistened, favorite, unfavorite o ninguna
  - Se ejecuta en `onEachOpen(releaseId)` callback al abrir cada tab

### Reglas de reset automático

Las siguientes acciones **limpian automáticamente `selectedIds`**:
1. Cambio de `searchQuery` → reset de selección
2. Cambio de cualquier campo en `filterState` → reset de selección
3. `clearAll()` → reset de todo el estado

El **`target`** (host/site en batch) se auto-resetea si:
1. El usuario cambia el `mode` (download → search → mark, etc.)
2. El `mode` es `download` y el host previamente seleccionado ya no existe en los hosts disponibles del scope actual (p.ej. al cambiar el filtro de source)

### Cómo se calculan los hosts disponibles en "Download from"

Los hosts se calculan dinámicamente en función del **scope efectivo**:
- **Count mode:** `releases.slice(0, count)` — primeros N releases filtrados
- **Selection mode:** `releases.filter(r => selectedIds.has(r.id))` — solo seleccionadas

Para cada release del scope, se iteran sus `downloads[]` y se extraen los `d.host` únicos. El resultado se muestra con conteo: `"Turbobit (47)"`.

Sobre los duplicados de host: los `host` son strings extraídos del texto visible en el HTML de cada site. Si el sitio fuente es inconsistente (unas páginas dicen `"Turbobit"` y otras `"turbobit.net"`), el sistema los trata como hosts distintos porque **no hay normalización en el dato almacenado**. La solución correcta es mejorar el extractor en el adapter, no normalizar en el store.

### Relación entre filtros y batch actions (invariantes)

1. **El BatchActionBar opera siempre sobre `filtered`** — nunca tiene acceso a releases fuera del filtro actual
2. **Cambiar un filtro resetea la selección** (`selectedIds.clear()`) — evita aplicar batch sobre releases ocultas
3. **El count en Count mode no se resetea** — el usuario decide cuántos, la lista debajo puede variar
4. **El target (host/site) se resetea al cambiar de modo** — evita dejar seleccionado un valor inválido
5. **El target se auto-resetea si el host desaparece** — al filtrar por source, los hosts disponibles cambian y el target inválido se limpia solo
6. **`selectJobId` no se resetea al cambiar filtros** — solo se limpia al cerrar batch mode (X)

Export/Import
  Settings.tsx
    ├─► exportAll() → download JSON
    └─► importAll(payload) → clear DB + bulkPut + refresh stores
```

---

## Temas (Theming)

### CSS Custom Properties en `index.css`

`:root` / `[data-theme='light']` y `[data-theme='dark']` definen:

- `--bg-primary`, `--bg-secondary`, `--bg-tertiary` (fondos)
- `--bg-card`, `--bg-card-hover`, `--bg-input`, `--bg-border`
- `--content`, `--content-secondary`, `--content-muted` (textos)
- `--border-main`, `--border-light`
- `--accent`, `--accent-hover`
- Clases utilitarias: `.bg-surface`, `.bg-surface-card`, `.text-content`, `.text-content-muted`, `.border-border-main`, etc.
- `bg-surface-tertiary/50`: regla CSS con `color-mix()` porque Tailwind no puede generar variantes de opacidad para variables CSS

`data-theme` se aplica en `<html>` por `ThemeProvider`. **No se usa la variante `dark:` de Tailwind.**

---

## PWA (Progressive Web App)

### Service Worker (Workbox vía `vite-plugin-pwa`)

El service worker se genera automáticamente en el build mediante `vite-plugin-pwa` con Workbox en modo `generateSW`.

| Config | Valor |
|--------|-------|
| `registerType` | `autoUpdate` — actualiza el SW en segundo plano sin molestar al usuario |
| `globPatterns` | `**/*.{js,css,html,svg,png}` — precachea todos los assets estáticos |
| `navigateFallback` | `/` — si la navegación falla offline, redirige al index |
| `precache` | 12 entries (~507 KB) |

El registro del SW lo inyecta automáticamente `vite-plugin-pwa` en el build (`dist/registerSW.js`).

### Manifest

Generado por el plugin en `dist/manifest.webmanifest`:

```json
{
  "name": "SCRP Music — Release Browser & Scraper",
  "short_name": "SCRP Music",
  "description": "Browse, search and manage music releases from any supported source via pluggable adapters",
  "theme_color": "#09090b",
  "background_color": "#09090b",
  "display": "standalone",
  "start_url": "/",
  "icons": [
    { "src": "/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Iconos

- `public/icon-192x192.png` — icono cuadrado azul con "M" blanca
- `public/icon-512x512.png` — mismo diseño, tamaño mayor para splash screens

### Meta tags en `index.html`

```html
<meta name="theme-color" content="#09090b" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icon-192x192.png" />
```

- `theme-color` se actualiza dinámicamente desde `ThemeProvider` según el tema (oscuro → `#09090b`, claro → `#ffffff`)

### Online/Offline detection

En `Layout.tsx`:
- Se escucha `window.addEventListener('online' / 'offline')`
- Estado almacenado en `useState(navigator.onLine)`
- Cuando offline: se muestra badge "Offline" con icono `WifiOff` en el sidebar (junto al título)
- Cuando online: no se muestra nada (oculto)

### Comportamiento offline

| Funcionalidad | Online | Offline |
|--------------|--------|---------|
| App shell (JS/CSS) | ✓ | ✓ (cacheado por SW) |
| Releases (IndexedDB) | ✓ | ✓ |
| Favoritos / Listened / History | ✓ | ✓ |
| Búsqueda Fuse.js | ✓ | ✓ |
| Scraper | ✓ | ❌ (error graceful) |
| YouTube Listen | ✓ | ❌ (error graceful) |
| CORS proxy fetch | ✓ | ❌ |

---

## Principios de arquitectura

1. **JSON inmutable** — Nunca se modifica. Es la fuente de verdad transitoria. Se mergea por ID.
2. **Separación de capas** — Types / Services / Stores / Components nunca se mezclan.
3. **Estado de usuario separado** — Lo que no está en el JSON origen va a IndexedDB.
4. **Virtualización** — Solo se renderizan items visibles.
5. **Búsqueda instantánea** — Fuse.js indexa en carga, busca en <30ms.
6. **Sin backend** — 100% client-side.
7. **Persistencia reactiva** — Cada cambio relevante persiste inmediatamente a IndexedDB.
8. **Scraper autónomo** — Corre en el navegador, con pausa/cancelación y progreso en tiempo real.
9. **Adaptador intercambiable** — Todo el código específico del origen vive en `local_adapters/`. El core nunca depende de un sitio en particular.

---

## Adapter Architecture

The core application is completely agnostic of the data source. Site-specific logic lives in `local_adapters/`, each file implementing the `ScraperAdapter` interface.

### Contract (`types/adapter.ts`)

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

- **`kind: AdapterKind`** — `'html'` para scrapers tradicionales o `'api'` para adaptadores basados en JSON API. El UI del Scraper se adapta automáticamente: HTML → detección de páginas + delays + proxy; API → solo género + start/end page + Fetch.
- **`supportsFastSkipExisting?: boolean`** — opcional. Solo debe activarse si el adapter puede identificar releases existentes desde el listado antes de pedir la página de detalle.
- **`getGenres()`** — returns the list of genres/categories the source supports
- **`getBaseUrl()`** — the root URL of the source site
- **`getCachedMaxPage()` / `clearCache()`** — manages the page-limit cache (stored in localStorage, keyed by adapter id)
- **`detectMaxPages()`** — exponential doubling + binary search to find the last valid page for a genre
- **`scrape()`** — the main entry point; receives options (page range, delays, proxy URL), abort signal, pause callback, and callbacks (`onProgress`, `onPageDone`, `onReleaseDone`, `onError`, `onComplete`). The adapter calls `onReleaseDone(release)` for each transformed `Release` it produces.
- **`getSearchLinks()`** — returns music-specific `QuickLink[]` for search platforms (YouTube Music, Spotify, etc.). Registered via `registerAdapterLinks()` on adapter init and shown per source in ReleaseCard.

### Options

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
```

### Callbacks

```ts
interface ScrapeAdapterCallbacks {
  onProgress(p: ScrapeProgress): void
  onPageDone(page: number, count: number, skipped?: number): void
  onReleaseDone(release: Release): void
  onReleaseSkipped?(title: string): void
  shouldSkipExistingRelease?(candidate: {
    source: string
    title: string
    urlRelease: string
  }): boolean
  onError(msg: string): void
  onComplete(results: Release[]): void
}
```

For fast-skip capable adapters, `scrape()` should check `options.fastSkipExisting` before fetching a detail page. If `callbacks.shouldSkipExistingRelease(...)` returns `true`, the adapter increments `releasesSkipped`, calls `onReleaseSkipped`, and does not emit `onReleaseDone` for that known release.

### Loading (auto-discovery via `import.meta.glob`)

At app start, `App.tsx` scans `local_adapters/*-adapter.ts` using Vite's `import.meta.glob`:

```ts
const adapterModules = import.meta.glob('../local_adapters/*-adapter.ts')

for (const [path, importFn] of Object.entries(adapterModules)) {
  const mod = await importFn()
  const AdapterClass = mod.default
  const instance = new AdapterClass()
  useScraperStore.getState().registerAdapter(instance)
}
```

Each adapter file must export a **default class** that implements `ScraperAdapter`. The class is instantiated and registered via `registerAdapter()`. If multiple adapters exist, a source selector appears in the Scraper page.

### CORS Proxy / Relay

The proxy URL is user-configurable from Settings, persisted in IndexedDB, and applied at app init via `setProxyUrl()` in `cors-proxy-proxy.ts`. The adapter uses either:
- `fetchWithProxy()` — for sites that work through a generic CORS proxy (corsproxy.io)
- `fetchDirectRelay()` — for sites that need browser-native headers forwarded through a Vite dev proxy endpoint (`/api/*-relay`)

The adapter chooses the appropriate method — the core does not enforce which.

### API Keys System

API keys are stored in `UserSettings.apiKeys: Record<string, string>` (IndexedDB). The key is the adapter `id` (e.g., `myAdapter`), value is the credential (e.g., `client_id`).

- **Settings UI**: Dynamic section in Settings → API Keys — inline inputs for Adapter name + API key (password with 👁️ toggle), ✓ Save, × Remove, + Add new. No hardcoded fields.
- **Adapter access**: `useSettingsStore.getState().settings.apiKeys[adapterId]` — read at runtime inside `scrape()` or `detectMaxPages()`. Required for `kind: 'api'` adapters; optional for `kind: 'html'`.
- **Validation**: Adapter should call `requireKey()` (throws friendly error) before making API calls.

### Writing a new adapter

1. Create `local_adapters/my-source-adapter.ts`
2. Implement `ScraperAdapter` interface (including `getSearchLinks()`)
3. **Set `kind: 'html' | 'api'`** — HTML for traditional scrapers (page detection, delays, proxy); API for JSON endpoints (no page detection, user defines page range)
3. **Export it as `default`** — auto-discovery via `import.meta.glob` picks it up automatically
4. The adapter should handle:
   - **If `kind: 'html'`**: HTML parsing for listing pages (extract release URLs, titles, cover thumbnails), HTML parsing for individual release pages (extract download links), cover image URL extraction (use `getAttribute('src')` not `.src`), page limit detection
   - **If `kind: 'api'`**: JSON API calls with `fetch`, handle pagination via `offset`/`limit`, transform API response to `Release[]`, handle API keys via `useSettingsStore.getState().settings.apiKeys[adapterId]`
5. Release identity: generate a stable `id`, and optionally `stableIdentity` for safer duplicate detection
6. Title parsing into artists / album / label / catalog / year
7. Set `source` on each release to your adapter's `id`
8. Optional: set `supportsFastSkipExisting=true` only if listing data is enough to check existing releases before detail-page fetches
9. No code changes needed in the core for normal adapters — just drop the file in `local_adapters/`

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
