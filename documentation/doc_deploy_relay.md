# Deploy & CORS Relay — Documentation

## Overview

SCRP Music uses a **Vercel Serverless Function** as a CORS relay proxy to bypass browser restrictions when scraping. This document covers deployment, configuration, and the relay architecture.

## Architecture

```
Local development:
  Browser → corsproxy.io → target site

Production (Vercel):
  Browser → /api/relay → target site
```

The relay is a Serverless Function in `api/relay.ts` that fetches content server-side (no CORS issues). The client detects relay availability via a health check and uses it automatically.

## Files Changed

| File | Purpose |
|------|---------|
| `api/relay.ts` | Serverless Function — proxies GET requests to target URLs |
| `api/tsconfig.json` | TypeScript config for Serverless Functions (Node.js types) |
| `.env` | Local environment variables (`RELAY_ENABLED=true`) |
| `.gitignore` | Added `.env` and `.env.local` |
| `src/services/cors-proxy.ts` | Relay detection, fallback to user-configured proxy |
| `src/services/youtube.ts` | Uses relay detection from cors-proxy |
| `src/pages/Settings.tsx` | UI shows relay status, proxy configuration |
| `src/App.tsx` | Calls `checkRelayHealth()` on startup |

## Deployment to Vercel

### Quick Start

1. Push to GitHub
2. Import in Vercel Dashboard
3. Vercel auto-detects Vite and Serverless Functions
4. Deploy

### Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `RELAY_ENABLED` | `true` | Set to `false` to disable the relay on this deployment |

### Controlling the Relay

**Disable the relay** (force users to use their own proxy):
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Set `RELAY_ENABLED=false`
3. Redeploy

**Enable the relay** (free, rate-limited):
1. Set `RELAY_ENABLED=true` (or remove the variable)
2. Redeploy

## How It Works

### Relay Health Check

On app startup, the client calls `GET /api/relay?health=1` to check if the relay is available:

```json
{ "enabled": true, "status": "ok" }
```

If `RELAY_ENABLED=false`, the relay returns:

```json
{ "error": "Relay is disabled by the deployment owner", "enabled": false }
```

### Client Logic

```
if (relay available AND proxyUrl is empty):
    use /api/relay (free, managed by deployment owner)
else:
    use configured proxyUrl (user-provided)
```

### Settings UI

- **Empty proxy URL** + relay available → "Using Vercel relay (free, managed by deployment owner)"
- **Custom proxy URL** + relay available → "Custom proxy configured — Vercel relay is available but not used"
- **Empty proxy URL** + relay unavailable → "Vercel relay unavailable — configure your own proxy below"

## Cost Control

### Vercel Free Tier (Hobby)

- **100 GB-hrs/month** included
- Each relay call ~100ms = ~0.00003 GB-hrs
- **~3 million calls/month** free
- More than sufficient for personal use

### When to Disable

Disable the relay (`RELAY_ENABLED=false`) if:
- Usage exceeds free tier
- You don't want to pay for others' usage
- Users should deploy their own instance

### User Alternatives

When relay is disabled, users can:
1. **Deploy their own Vercel instance** (free tier)
2. **Configure a CORS proxy** in Settings (e.g., corsproxy.io, allorigins.win)
3. **Self-host** the relay function on their own infrastructure

## CORS Proxy URL Setting

In **Settings → CORS Proxy URL**:

| Value | Behavior |
|-------|----------|
| Empty (default) | Uses Vercel relay if available |
| `https://corsproxy.io/?` | Uses corsproxy.io |
| `https://api.allorigins.win/raw?url=` | Uses allorigins.win |
| Custom URL | Uses your own CORS proxy |

## Local Development

The `.env` file sets `RELAY_ENABLED=true` for local testing. For local development:

1. The relay health check runs against `localhost:5173/api/relay`
2. Vite serves the relay via the `relayDevPlugin()` middleware in `vite.config.ts` — it replicates the serverless function on `/api/relay` in `npm run dev` (no proxy config needed)
3. Or just use `corsproxy.io` directly (default behavior)

To test with relay disabled locally, set `RELAY_ENABLED=false` in `.env` and restart the dev server.

## Troubleshooting

### "HTTP 403" in production

- Check if `RELAY_ENABLED=false` in Vercel env vars
- Check Vercel Function logs for errors
- The target site may be blocking the relay's IP
- If the site is protected by **Cloudflare** ("Attention Required"), the relay will keep returning 403 — the server-side fetch carries no browser cookies. Use a CORS proxy (`proxy`) or browser `direct` mode for that site instead.

### TypeScript error "Cannot find name 'process'"

- Ensure `api/tsconfig.json` exists with `"types": ["node"]`
- Run `npm install` to ensure `@types/node` is installed

### Relay not appearing in Settings

- Check browser console for health check errors
- Verify `/api/relay` endpoint exists in deployed Vercel project
