import { getDefinition } from './adapter-registry'

export type FetchKind = 'direct' | 'relay' | 'proxy' | 'unknown'

export interface FetchInfo {
  kind: FetchKind
  transport: 'direct' | 'local-relay' | 'vercel-relay' | 'custom-proxy' | 'none' | 'unknown'
  label: string
  detail: string
  warning?: string
}

export interface FetchInfoContext {
  env: 'dev' | 'prod'
  relayAvailable: boolean | null
  proxyUrl: string
}

export function getFetchInfo(adapterId: string, ctx: FetchInfoContext): FetchInfo {
  const def = getDefinition(adapterId)
  const mode = def?.fetch?.mode ?? 'unknown'
  const relayBase = def?.fetch?.relayBase ?? '/api/relay'

  if (mode === 'direct') {
    return {
      kind: 'direct',
      transport: 'direct',
      label: 'Direct',
      detail: 'Fetch directly to the source (CORS handled by the source)',
    }
  }

  if (mode === 'relay') {
    return {
      kind: 'relay',
      transport: ctx.env === 'prod' ? 'vercel-relay' : 'local-relay',
      label: `Relay (${relayBase})`,
      detail: ctx.env === 'prod'
        ? 'Vercel serverless function (api/relay.ts)'
        : 'Vite dev middleware (configureServer /api/relay)',
    }
  }

  if (mode === 'proxy') {
    const proxyUrl = ctx.proxyUrl.trim()
    if (proxyUrl) {
      let host = proxyUrl
      try {
        host = new URL(proxyUrl).hostname
      } catch {
        host = proxyUrl
      }
      return {
        kind: 'proxy',
        transport: 'custom-proxy',
        label: `Proxy (${host})`,
        detail: 'Custom CORS proxy from Settings → CORS Proxy',
      }
    }
    if (ctx.relayAvailable === true) {
      return {
        kind: 'proxy',
        transport: ctx.env === 'prod' ? 'vercel-relay' : 'local-relay',
        label: `Relay (${relayBase})`,
        detail: ctx.env === 'prod'
          ? 'Proxy URL empty — using Vercel serverless relay'
          : 'Proxy URL empty — using Vite dev relay middleware',
        warning: ctx.env === 'dev'
          ? 'In dev, proxy-mode adapters always use the configured Proxy URL. Clear it only in production.'
          : undefined,
      }
    }
    return {
      kind: 'proxy',
      transport: 'none',
      label: 'No proxy configured',
      detail: 'Proxy URL is empty and the relay is unavailable',
      warning: 'Scraping CORS-blocked sources will fail. Set a proxy URL or enable the relay.',
    }
  }

  return {
    kind: 'unknown',
    transport: 'unknown',
    label: 'Legacy adapter',
    detail: 'No JSON definition — fetch mode unknown',
  }
}
