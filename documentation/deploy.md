# Deploy & CORS Relay — SCRP Music

Guía de despliegue y configuración del relay. La app es una SPA (React + Vite) que funciona sin backend; el único componente servidor es el **relay CORS** (`api/relay.ts`), que evita bloqueos de CORS al scrapear. Dependiendo de dónde lo desplegues, el relay está disponible o no.

Compañeras de esta guía: [`NETWORK.md`](./NETWORK.md) (modos de red) y [`Architecture.md`](./Architecture.md) (diseño general).

## Opciones de despliegue

| Opción | Relay CORS | Dificultad | Para quién |
|--------|------------|------------|------------|
| **Vercel** (recomendado) | Sí (serverless `/api/relay`) | Baja | Uso personal gratuito, cero mantenimiento |
| **Docker / self-host** | Sí (servidor Node incluido) | Media | Quien quiera control total, HTTPS propio, privacidad |
| **Hosting estático** (Netlify, GitHub Pages, Nginx simple…) | No | Baja | Solo navegación; los usuarios usan su propio proxy |

## Variables de entorno

Referencia completa en [`.env.example`](../.env.example) (copiar a `.env` para dev local).

| Variable | Momento | Default | Descripción |
|----------|---------|---------|-------------|
| `RELAY_ENABLED` | **Runtime** (server) | `true` | `false` desactiva el relay en este despliegue (Vercel y Docker). |
| `PORT` | **Runtime** (server) | `3000` | Puerto del servidor Node en Docker / self-host. |
| `VITE_DEFAULT_PROXY` | **Build** (Vite) | `https://corsproxy.io/?` | Proxy CORS por defecto cuando el usuario no configura uno en Settings. Se hornea en el bundle. |

---

## 1. Vercel (recomendado)

### Quick Start

1. Sube el repo a GitHub.
2. Importa el proyecto en Vercel Dashboard → *Add New → Project*.
3. Vercel detecta Vite + Serverless Functions automáticamente.
4. En *Settings → Environment Variables* añade las que necesites (normalmente ninguna).
5. *Deploy*.

Notas:

- `vercel.json` solo contiene el rewrite SPA (`/index.html`); Vercel enruta `/api/*` a `api/*` automáticamente.
- El relay es una Serverless Function en `api/relay.ts` que fetchea contenido server-side (sin problemas de CORS).

### Controlar el relay

**Desactivar el relay** (forzar a los usuarios a usar su propio proxy):
1. Vercel Dashboard → Tu proyecto → Settings → Environment Variables
2. Pon `RELAY_ENABLED=false`
3. Redeploy

**Activar el relay** (gratis, con límite de rate):
1. Pon `RELAY_ENABLED=true` (o elimina la variable)
2. Redeploy

### Costes (plan Hobby gratuito)

- **100 GB-hrs/mes** incluidos
- Cada llamada al relay ~100ms ≈ 0.00003 GB-hrs
- **~3 millones de llamadas/mes gratis**
- Más que suficiente para uso personal

Desactiva el relay (`RELAY_ENABLED=false`) si:
- El uso supera el free tier
- No quieres pagar por el uso de otros
- Prefieres que cada usuario despliegue su propia instancia

Cuando el relay está desactivado, los usuarios pueden:
1. **Desplegar su propia instancia de Vercel** (free tier)
2. **Configurar un proxy CORS** en Settings (p. ej. corsproxy.io, allorigins.win)
3. **Self-host** la función relay en su propia infraestructura

---

## 2. Docker / self-host

El `Dockerfile` compila la app y el servidor Node (`server/index.ts`), que sirve el estático (`dist/`) con fallback SPA y monta el relay en `/api/relay`. La imagen final solo contiene Node 22 + los bundles (sin `node_modules`).

### Cómo probar localmente (paso a paso)

**Requisitos**: Docker (Desktop o Engine) instalado y en ejecución.

1. **Construir la imagen** (desde la raíz del proyecto):

   ```bash
   docker build -t scrp-music .
   ```

   Para cambiar el proxy CORS por defecto:

   ```bash
   docker build --build-arg VITE_DEFAULT_PROXY="https://api.allorigins.win/raw?url=" -t scrp-music .
   ```

2. **Arrancar el contenedor**:

   ```bash
   docker run -d -p 3000:3000 --name scrp-music -e RELAY_ENABLED=true scrp-music
   ```

   O con Docker Compose (build + run + restart automático):

   ```bash
   docker compose up -d --build
   ```

3. **Verificar que funciona** (5 comprobaciones):

   ```bash
   # (a) App web
   open http://localhost:3000

   # (b) Health del relay → {"enabled":true,"status":"ok"}
   curl "http://localhost:3000/api/relay?health=1"

   # (c) Relay scrapeando una URL → HTML de example.com
   curl -s "http://localhost:3000/api/relay?url=https://example.com" | head

   # (d) Fallback SPA: cualquier ruta devuelve index.html (200)
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/settings

   # (e) Logs del contenedor → "SCRP Music listening on http://localhost:3000"
   docker logs -f scrp-music
   ```

4. **Probar el relay desactivado**:

   ```bash
   docker rm -f scrp-music
   docker run -d -p 3000:3000 --name scrp-music -e RELAY_ENABLED=false scrp-music
   curl "http://localhost:3000/api/relay?health=1"
   # → HTTP 503 {"error":"Relay is disabled by the deployment owner","enabled":false}
   # La app seguirá funcionando; usaría el proxy por defecto/configurado.
   ```

5. **Parar y limpiar**:

   ```bash
   docker compose down          # si usas compose
   docker rm -f scrp-music      # si usaste docker run
   docker rmi scrp-music        # eliminar la imagen
   ```

### Notas para producción

- **Reverse proxy + HTTPS**: pon el contenedor tras Caddy/Traefik/Nginx con TLS; el relay solo usa `http://localhost:3000` internamente.
- **Reconstrucción**: `docker compose up -d --build` recompila con el código nuevo.
- **Sin Docker**: compilar y arrancar directamente:

  ```bash
  npm ci
  npm run build        # tsc -b && vite build → dist/
  npm run build:server # tsc server → dist-server/
  npm start            # node dist-server/server/index.js
  ```

---

## 3. Hosting estático (sin relay)

Servir solo el bundle (Netlify, GitHub Pages, un `nginx` simple…):

```bash
npm ci
npm run build          # produce dist/
```

Sube `dist/` a tu hosting con rewrite SPA (toda ruta → `index.html`).

Aviso: **sin relay**, el health check falla y la app informa *"relay unavailable — configure your own proxy"*. Cada usuario debe configurar un proxy CORS en **Settings → CORS Proxy URL** (p. ej. `https://corsproxy.io/?`). El proxy por defecto para usuarios nuevos se fija en build con `VITE_DEFAULT_PROXY`.

---

## Cómo funciona el relay

### Arquitectura

```
Dev local:      Browser → /api/relay (middleware Vite, respeta RELAY_ENABLED)
Vercel:         Browser → /api/relay (serverless function)
Docker:         Browser → /api/relay (servidor Node en el contenedor)
Sin relay:      Browser → proxy CORS configurado por el usuario → sitio
```

El cliente detecta el relay con `GET /api/relay?health=1` y lo usa automáticamente cuando está disponible y el usuario no ha configurado un proxy propio.

### Relay Health Check

Al arrancar, el cliente llama a `GET /api/relay?health=1`:

```json
{ "enabled": true, "status": "ok" }
```

Si `RELAY_ENABLED=false`, el relay devuelve:

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

- **Proxy URL vacío** + relay disponible → "Using Vercel relay (free, managed by deployment owner)"
- **Proxy URL propio** + relay disponible → "Custom proxy configured — Vercel relay is available but not used"
- **Proxy URL vacío** + relay no disponible → "Vercel relay unavailable — configure your own proxy below"

### CORS Proxy URL Setting

En **Settings → CORS Proxy URL**:

| Valor | Comportamiento |
|-------|----------------|
| Vacío (default) | Usa el relay si está disponible |
| `https://corsproxy.io/?` | Usa corsproxy.io |
| `https://api.allorigins.win/raw?url=` | Usa allorigins.win |
| URL personalizada | Usa tu propio proxy CORS |

---

## Local Development

El `.env` local fija `RELAY_ENABLED=true`. Para desarrollo:

1. El health check del relay corre contra `localhost:5173/api/relay`
2. Vite sirve el relay vía el middleware `relayDevPlugin()` en `vite.config.ts` — replica la serverless function en `/api/relay` en `npm run dev` (sin necesidad de configurar proxy)
3. O simplemente usar `corsproxy.io` directamente (comportamiento por defecto)

Para probar con relay desactivado localmente, pon `RELAY_ENABLED=false` en `.env` y reinicia el dev server. El middleware respeta esta variable y devuelve `503 / enabled:false`, igual que la serverless function.

---

## Archivos implicados

| Archivo | Propósito |
|---------|-----------|
| `api/relay.ts` | Serverless Function / relay — proxya peticiones GET a URLs objetivo |
| `api/tsconfig.json` | Config de TypeScript para funciones serverless (tipos Node.js) |
| `server/index.ts` | Servidor Node para Docker/self-host (estático + relay) |
| `Dockerfile` / `docker-compose.yml` | Imagen multi-stage y orquestación |
| `.env` | Variables de entorno locales (`RELAY_ENABLED=true`) |
| `.env.example` | Referencia committeada de variables de entorno |
| `src/services/cors-proxy.ts` | Detección del relay, fallback a proxy configurado |
| `src/services/youtube.ts` | Usa la detección del relay desde cors-proxy |
| `src/pages/Settings.tsx` | UI que muestra el estado del relay y la configuración del proxy |
| `src/App.tsx` | Llama a `checkRelayHealth()` al arrancar |

---

## Troubleshooting

### "HTTP 403" en producción

- Comprueba si `RELAY_ENABLED=false` en las env vars de Vercel
- Revisa los logs de la función en Vercel
- El sitio objetivo puede estar bloqueando la IP del relay
- Si el sitio está protegido por **Cloudflare** ("Attention Required"), el relay seguirá devolviendo 403 — el fetch server-side no lleva cookies de navegador. Usa un proxy CORS (`proxy`) o el modo `direct` del navegador para ese sitio.

### Error de TypeScript "Cannot find name 'process'"

- Asegúrate de que `api/tsconfig.json` existe con `"types": ["node"]`
- Ejecuta `npm install` para asegurar que `@types/node` está instalado

### El relay no aparece en Settings

- Revisa la consola del navegador por errores del health check
- Verifica que el endpoint `/api/relay` existe en el proyecto desplegado
