# Network & Adapter Configuration

This document describes how SCRP Music fetches content from scraping sources: the three network modes, how the routing decision is made in each environment, and the recent changes to the fetch/relay pipeline.

Companion docs: [`deploy.md`](./deploy.md) (relay deployment & configuration) and [`Architecture.md`](./Architecture.md) (overall design). Each adapter's own configuration is documented in its README under [`local_adapters/`](./local_adapters).

---

## 1. Network modes

Every adapter definition declares a fetch mode in its `fetch.mode` field (`local_adapters/*.json`). Each adapter's README documents which mode it uses:

| Mode | How requests are sent |
|------|-----------------------|
| **`relay`** | `fetchDirectRelay()` → `<relayBase>?url=<target>`. Always routed through the relay, **ignores the Settings proxy URL**. This is a **server-side (Node) fetch** — some sites protected by Cloudflare reject it with HTTP 403 "Attention Required" (the request carries no browser cookies). |
| **`proxy`** | `fetchWithProxy()` → `buildFetchUrl()` picks relay or the user's custom proxy (see §2). Good default for Cloudflare-protected sites that block the relay. |
| **`direct`** | Plain `fetch` to the source. Only viable when the source sends permissive CORS headers (e.g. public APIs). |

> **Rule of thumb for HTML sites**: do not default them to `relay`. If the site blocks the relay with 403 (Cloudflare / anti-bot), switch to `proxy` or `direct`. In the adapter builder, the AI prompt mirrors the transport the app used to fetch the sample (`fetch.mode` must equal the sample transport), so the adapter automatically uses the path that already worked.

The fetch code lives in `src/services/cors-proxy.ts`. Both relayed and proxied requests:
- send a Chrome user-agent + HTML accept headers,
- use a **30 s timeout** (`FETCH_TIMEOUT_MS`) that fails fast on timeout,
- retry up to 3 times with backoff on transient errors (but never on timeout).

---

## 2. Routing decision (`buildFetchUrl`)

For **proxy-mode** adapters the effective transport is decided at runtime:

```
if environment is production (hostname !== 'localhost')
   AND relay is healthy
   AND Settings proxy URL is empty:
      use /api/relay?url=<target>
else:
      use <Settings proxyUrl><target>
```

Key facts:

- The **default** Settings proxy URL is `https://corsproxy.io/?` (`src/stores/settings.ts`). Because it is never empty, proxy-mode adapters use corsproxy.io in both dev and prod unless the user clears it.
- **Relay-mode adapters never read the Settings proxy URL** — they always go through `/api/relay`. This is the reliable path for sources that block public CORS proxies.
- The relay is only used by proxy-mode adapters when **all three** conditions hold (production, healthy relay, empty proxy URL).

---

## 3. Environments

### Development (`npm run dev`, host `localhost`)

- Vite serves an **in-memory relay middleware** on `/api/relay` (`vite.config.ts`, `relayDevPlugin`) that replicates the production serverless function:
  - `GET /api/relay?health=1` → `{ "enabled": true, "status": "ok" }`
  - `GET /api/relay?url=<target>` → server-side fetch (Node) with a 15 s timeout and Chrome UA; returns upstream status + content-type.
- The app's health check now runs in dev too (it was previously disabled), so the UI reflects the local middleware state.
- Proxy-mode adapters still use the configured proxy URL in dev (the production-only gate in `buildFetchUrl` keeps that behaviour).

### Production (Vercel)

- `api/relay.ts` is the serverless function behind `/api/relay`.
- Honors `RELAY_ENABLED` env var (`false` → `503`), fetches upstream with a 15 s timeout, forwards status + content-type, and sets `Cache-Control: s-maxage=60, stale-while-revalidate`.
- Health check endpoint: `GET /api/relay?health=1`.

---

## 4. Where the UI shows this

- **Settings → CORS Proxy** (`src/pages/Settings.tsx`):
  - Environment badge **DEV (localhost)** / **PROD (Vercel)**.
  - Relay status (checking / available / unavailable) with environment-specific wording.
  - **Active transport per source**: a table listing every loaded adapter with its effective transport (Relay / custom proxy / direct) and a warning dot when scraping would fail (e.g. empty proxy + relay unavailable).
- **Scraper page** (`src/pages/Scraper.tsx`):
  - A **Transport badge** under the Source selector showing the active source's effective transport, resolved live from the adapter definition, environment, relay health and the Settings proxy URL.

The shared reactive state lives in `src/stores/network.ts` (`env`, `relayAvailable`, `check()`), initialized once in `App.tsx`. The resolution logic is in `src/services/fetch-info.ts`.

---

## 5. Per-adapter configuration

Each adapter ships its own README next to its JSON definition under [`local_adapters/`](./local_adapters) (e.g. `<id>-README.md`), documenting its fetch mode, genre list, page detection strategy and selectors. Refer to those files for the per-source details.

### Page detection modes

| Mode | How max pages is found |
|------|------------------------|
| `api-count` | One request to a count endpoint; reads total from a JSON field (e.g. `response.numFound`, `headers.results_fullcount`). |
| `binary-search` | Binary search over page numbers until a request returns an empty/nonexistent page. Used when the site does not expose its last page in HTML. |
| `html-last-page` | One request to page 1; scans the HTML for `lastPageRegex` and takes the largest number found. Instant and avoids the 404 noise of binary search. Used when the site's pagination links expose the last page. |
| `client-side` | No pagination (single JSON payload). |

### Page-limit cache

Detected limits are cached in localStorage under `{adapterId}_page_limits` as `{ [genreId]: { maxPage, detectedAt } }`. To force re-detection, use **Settings → Reset All Data** or clear the site's localStorage.

---

## 6. Recent changes (fetch/relay pipeline)

1. **Timeouts & fail-fast** (`src/services/cors-proxy.ts`): 30 s timeout on every request via `withTimeout()`; `isTimeoutError()` stops retrying on timeouts so a dead source can't hang a scrape.
2. **Relay URL fix** (`fetchDirectRelay`): relay requests now use `?url=<encoded target>` instead of forwarding the full path — matches the real `/api/relay` contract.
3. **HTML sources switched to relay mode**: the HTML adapters moved from `proxy` (corsproxy.io, which was returning 403s and hanging) to the built-in relay via `relayBase: "/api/relay"`.
4. **Relay route fix**: an adapter pointed at a non-existent relay route; now `/api/relay`. The route had never existed — the source silently returned "0 releases".
5. **Dev relay middleware** (`vite.config.ts`): `relayDevPlugin()` serves `/api/relay` in `npm run dev`, so relay-mode adapters work locally without deploying.
6. **`html-last-page` detection** (`src/types/adapter-definition.ts` + `src/services/adapter-engine.ts`): new detection mode + `lastPageRegex`; detection on the relayed HTML source went from ~23 probe requests (with 404s in the console) to a single request. Verified live: 2273 pages detected.
7. **Dev relay health check enabled** (`checkRelayHealth`): no longer gated to production, since the dev middleware provides the endpoint.
8. **Cloudflare 403 finding**: the relay is a server-side (Node) fetch with no browser cookies, so Cloudflare-protected sites reject it with HTTP 403 "Attention Required" — no relay, proxy or allorigins workaround fixed it. The reliable path for such sites is `proxy` (CORS proxy) or `direct` (browser fetch). The adapter builder now: (a) mirrors the actual sample transport into the prompt so `fetch.mode` matches the path that already worked, and (b) shows an amber panel in "Test live" (HTTP 403/429/Cloudflare/"Attention Required") with one-click **Switch to CORS proxy** / **Switch to direct**.

---

## 7. Adding a new adapter

1. Create `local_adapters/<id>.json` following the `AdapterDefinition` type (`src/types/adapter-definition.ts`).
2. Pick the fetch mode: `proxy` for JSON APIs behind a CORS proxy, `direct` only for CORS-friendly APIs, and `relay` only for sites that block CORS proxies but allow server-side fetch (remember: Cloudflare-protected sites reject the relay with HTTP 403 — use `proxy`/`direct` for those).
3. For relay mode set `fetch.relayBase: "/api/relay"` and, when the site exposes its last page in the pagination HTML, prefer `pagination.detection: "html-last-page"` + `lastPageRegex` over `binary-search`.
4. Restart `npm run dev`; the adapter is auto-registered (definitions take precedence over the legacy TS adapters in `local_adapters/*-adapter.ts`).
