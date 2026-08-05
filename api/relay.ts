export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (process.env.RELAY_ENABLED === 'false') {
    return res.status(503).json({
      error: 'Relay is disabled by the deployment owner',
      enabled: false,
    })
  }

  const { url, health } = req.query

  if (health === '1') {
    return res.status(200).json({
      enabled: process.env.RELAY_ENABLED !== 'false',
      status: 'ok',
    })
  }

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing "url" query parameter' })
  }

  let targetUrl: URL
  try {
    targetUrl = new URL(url)
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return res.status(400).json({ error: 'Only http/https URLs are allowed' })
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
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate')

    const body = await upstream.text()
    res.status(upstream.ok ? upstream.status : upstream.status).send(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(502).json({ error: `Upstream fetch failed: ${message}` })
  }
}
