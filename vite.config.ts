import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

function relayDevPlugin(relayEnabled: boolean): Plugin {
  return {
    name: 'relay-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/relay', async (req, res) => {
        const reqUrl = new URL(req.url || '/', 'http://localhost')

        if (!relayEnabled) {
          res.statusCode = 503
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Relay is disabled by the deployment owner', enabled: false }))
          return
        }

        if (reqUrl.searchParams.get('health') === '1') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ enabled: true, status: 'ok' }))
          return
        }

        const target = reqUrl.searchParams.get('url')
        if (!target) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Missing "url" query parameter' }))
          return
        }

        let targetUrl: URL
        try {
          targetUrl = new URL(target)
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Invalid URL' }))
          return
        }

        if (!['http:', 'https:'].includes(targetUrl.protocol)) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Only http/https URLs are allowed' }))
          return
        }

        try {
          const upstream = await fetch(targetUrl.toString(), {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(15000),
          })

          const contentType = upstream.headers.get('content-type') || 'text/plain'
          res.setHeader('Content-Type', contentType)
          res.setHeader('Cache-Control', 'no-cache')
          res.statusCode = upstream.status
          res.end(await upstream.text())
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: `Upstream fetch failed: ${message}` }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const relayEnabled = env.RELAY_ENABLED !== 'false'

  return {
    server: {
      proxy: {},
    },
    plugins: [
      relayDevPlugin(relayEnabled),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'SCRP Music — Release Browser & Scraper',
          short_name: 'SCRP Music',
          description: 'Browse, search and manage music releases from any supported source via pluggable adapters',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png}'],
          navigateFallback: '/',
        },
      }),
    ],
  }
})
