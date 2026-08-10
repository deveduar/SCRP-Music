# SCRP Music — Music Release Browser & Scraper

A **single-page application** (SPA) for browsing, searching, and managing music releases scraped via a **pluggable adapter system**. Built with React 19 + TypeScript 6 + Vite 8, featuring a dark/light theme, fuzzy search, virtualized list, persistent state via IndexedDB, and an integrated scraper with CORS proxy support.

## Features

### Release Management
- **Scrape directly** from supported sources via a pluggable adapter — genre selector, configurable page range and delays
- **Automatic page limit detection** per genre (exponential doubling + binary search, cached)
- **Intelligent merging**: re-scraping adds new download links without duplicating existing ones
- **Fuzzy search** across title, artists, label, catalog, album via Fuse.js
- **Multi-field sorting**: year, title, label, artist, catalog, scrape date (asc/desc)
- **Filters**: listened, unlistened, favorited, by scrape job — combined in AND

### Virtualized List (TanStack Virtual)
- Smooth scrolling with thousands of releases
- Dynamic row height measurement
- Compact card mode: single-line metadata summary, favorite/listen actions, and an expandable details panel that reveals the same content as the full card (downloads, quick links, YouTube, notes)
- Full and compact browse layouts available from the toolbar for different review workflows

### Integrated Scraper
- Genres provided by the active adapter
- Detects last valid page per genre (cached with timestamp)
- Pause / resume / cancel via AbortController
- Auto-loads scraped results into the browser
- **Skip updates for existing releases** — scrape normally, but only add new releases during the final merge
- **Fast skip existing release pages** — for adapters that support it, skip already-known detail pages before fetching them
- Progress bar, real-time log, error tracking
- Recent Jobs section showing +N new/updated per job
- Export scraped results as JSON
- **Two adapter modes**: HTML scrapers with page detection, delays and optional proxy; API adapters using JSON endpoints with dynamic API keys — UI auto-adapts to adapter kind
- **No-code adapter builder** — a dedicated **Adapters** page with a wizard to create adapters without touching code: form steps (Basics, Transport, Genres, Pagination, Structure, URLs, Field Mapping), a JSON editor with live validation, live testing (**Test live** + **Test genres**, which verifies each genre's page-1 URL to catch broken slugs), and an AI copy-prompt helper that downloads a real sample of the source and generates a ready-to-paste adapter JSON

### Persistent State (IndexedDB via Dexie)
- **Favorites** and **listen status** per release
- **Personal notes** per release
- **History**: chronological log of opens, link clicks, favorites, listens, scrape completions, page detections, batch actions
- **Settings**: dark mode, items per page
- Survives page reloads and browser restarts

### Quick Search Links
- **4 global links** (Google, YouTube, Yandex, DuckDuckGo) shown on every release
- **Per-adapter music links** (13 platforms) shown when the release's source adapter provides them: YouTube Music, Spotify, Beatport, Bandcamp, Discogs, SoundCloud, Apple Music, Traxsource, Juno Download, Deezer, Tidal, Boomkat, Resident Advisor, RateYourMusic

### YouTube Inline Playback
- Searches YouTube via public API + CORS proxy fallback
- Tries multiple query variations (artist+title, title only, with/without parenthetical content)
- Auto-marks release as listened when video is found
- In-memory cache to avoid repeated lookups

### Batch Actions
- **6 modes**: download, search, mark-listened, mark-unlistened, mark-favorite, mark-unfavorite
- **Count or selection mode**: pick N releases or check specific ones
- **Auto-select**: by status (listened, unlistened, favorite, unfavorite) with dynamic counts, "All releases", or a specific job — options with 0 count are hidden
- Configurable delay between tab openings
- **Auto-mark dropdown**: listened, unlistened, favorite, unfavorite (on open for URL modes)
- **Projected open count** shown on the execute button (after host filter)
- **Dynamic info row**: `filterSummary` (active filters/search) + `actionSummary` (batch config)
- **Filters override batch**: changing filters clears selected IDs
- **3-row layout** with `min-h-28` for consistent height
- State persisted in `localStorage` across page navigation

### Dashboard
- Total releases, listened, favorites, artists, labels
- Year range, total download links
- Downloads by host (bar chart), clicks by host (from history)
- Last scrape job card

### Data Management (Settings)
- **Export All Data**: downloads releases + user state + history + jobs + settings as JSON
- **Import All Data**: replace current data from a JSON file (with validation and confirmation)
- **3 Reset buttons**: Reset All (full), Reset User Data (keeps releases), Reset Scrape Data (keeps favorites/history)

### Theme
- Dark/light mode via CSS custom properties and `data-theme` attribute
- Real-time switching without page reload
- No Tailwind `dark:` variant — all theme-aware classes use CSS variables

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | React 19 |
| Language | TypeScript 6 |
| Bundler | Vite 8 |
| Styling | TailwindCSS 4 |
| State | Zustand 5 |
| Storage | Dexie 4 (IndexedDB) |
| Validation | Zod 4 |
| Virtualization | TanStack Virtual 3 |
| Search | Fuse.js 7 |
| Icons | Lucide React |
| Routing | React Router 7 |

## Architecture

See [`Architecture.md`](./documentation/Architecture.md) for the full architecture breakdown — types, services, stores, components, pages, data flow, and theming.

## Usage

```bash
npm install
npm run dev            # development server (HMR)
npm run build          # tsc -b && vite build
npm run preview        # preview production build
npm run build:server   # compile the Docker/Node server (dist-server/)
npm start              # run the Node server (static + /api/relay) after build:server
```

The app runs entirely in the browser — no backend required. All data is stored in IndexedDB and survives page reloads.

### Getting Started
1. Open the **Scraper** page, select a genre, optionally detect max pages, set page range, and start scraping
2. Or load a pre-exported JSON file from Settings → Import All Data
3. Browse releases, mark favorites, listen via YouTube, take notes

## Configuration

- **CORS proxy URL**: configurable in the Scraper page (default: `https://corsproxy.io/?`; override at build time with `VITE_DEFAULT_PROXY`)
- **Relay**: server-side fetch on `/api/relay` (Vite dev middleware + Vercel serverless function + Docker/Node server) that bypasses CORS
- **Page limit cache**: stored in `localStorage` (adapter-specific key)
- **Batch action bar state**: persisted in `localStorage` under `batch_action_bar`
- **Selection state**: `batch_selection_mode` and `batch_selected_ids` in `localStorage`
- **User settings**: stored in IndexedDB
- **API Keys**: stored in IndexedDB (Settings → API Keys), dynamic per-adapter (e.g. `myAdapter: "client_id"`). Required for API-based adapters.
- **Environment variables**: see [`.env.example`](./.env.example) — `RELAY_ENABLED` (runtime), `PORT` (Docker/Node server), `VITE_DEFAULT_PROXY` (build-time), `VITE_DEFAULT_API_KEYS` / `VITE_API_KEY_<FIELD>` (build-time, seed API keys into Settings — see [api-keys.md](./documentation/api-keys.md))

## Deployment

See [`deploy.md`](./documentation/deploy.md) for deployment options: **Vercel** (recommended, serverless relay), **Docker / self-host** (Node server with built-in relay), or **static hosting** (no relay — users configure their own CORS proxy).

## Project Structure

```
src/
├── components/     # Reusable UI components (Layout, ReleaseCard, ReleaseList, etc.)
├── pages/          # Route pages (Dashboard, Browse, Scraper, History, Stats, Settings)
├── services/       # Business logic (search, CORS proxy, YouTube, batch actions, links)
├── storage/        # IndexedDB layer (Dexie schema v4 + CRUD + export/import)
├── stores/         # Zustand stores (releases, user state, settings, scraper)
├── types/          # TypeScript interfaces (release, user state, scraper, adapter, export, links)
└── ... App.tsx, main.tsx, index.css
local_adapters/     # Pluggable site-specific adapters (one file per source + shared utilities)
documentation/      # Technical & user documentation (architecture, network, adapter builder guide)
```

## Legal Disclaimer

This software is provided as-is for educational and personal use. The built-in adapters scrape only from legal, publicly accessible sources (royalty-free music, Creative Commons APIs, public domain archives). However, users may create custom adapters for any website. **You are solely responsible for ensuring that your use of this software complies with all applicable laws and terms of service of the sites you access.** See [TERMS.md](./documentation/TERMS.md) for full terms.
