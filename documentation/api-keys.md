# API Keys y adapters JSON — SCRP Music

Este documento explica cómo funcionan las API keys en los adapters, tanto en los **built-in** (`local_adapters/*.json`) como en los **custom** creados con el builder. Complementa a [`deploy.md`](./deploy.md) (variables de entorno) y [`builder_guide.md`](./builder_guide.md) (crear adapters).

## Modelo de dos partes

Cada adapter que necesita autenticarse con una API separa **qué necesita** (declaración en el JSON) de **el valor** (guardado en Settings):

| Parte | Dónde vive | Quién lo define |
|-------|-----------|-----------------|
| **Declaración** (`apiKeyRequired`, `apiKeyField`, `apiKeyParamName`) | El JSON del adapter | El autor del adapter (built-in o builder) |
| **Valor** (la clave en sí) | `settings.apiKeys` (IndexedDB, por usuario y navegador) | Cada usuario en *Settings → API Keys*, o seed por env |

El JSON nunca guarda el valor real de la clave; solo dice *"este adapter necesita una clave"* y cómo debe enviarla.

## Las 3 propiedades de declaración

Se definen dentro del bloque `api` del adapter:

| Propiedad | Ejemplo (Jamendo) | Qué significa |
|-----------|-------------------|---------------|
| `apiKeyRequired` | `true` | Este adapter no funciona sin clave. El motor avisa si falta. |
| `apiKeyField` | `"jamendo"` | Nombre interno bajo el que se guarda la clave en Settings (`settings.apiKeys.jamendo`). |
| `apiKeyParamName` | `"client_id"` | Nombre del query param con el que se envía a la API. |

## Cómo fluye la clave en el motor

En `src/services/adapter-engine.ts`:

1. Al scrapear o detectar páginas, si `api.apiKeyRequired` es `true`, el motor lee `settings.apiKeys[api.apiKeyField]` desde el store (`adapter-engine.ts:509-512`, `584-593`).
2. Si falta la clave, lanza: `"<Nombre> requires an API key. Add it in Settings > API Keys as \"<apiKeyField>\""`.
3. Si existe, la inyecta como query param en la URL de la API (`adapter-engine.ts:425-428`):

   ```ts
   const separator = url.includes('?') ? '&' : '?'
   url += `${separator}${def.api.apiKeyParamName}=${apiKey}`
   ```

   La misma inyección se aplica a `countUrlTemplate` (detección de páginas, `adapter-engine.ts:360-363`).

4. El tester (`adapter-tester.ts:41-46`) detecta la falta de clave y la reporta como `apiKeyMissing` en el panel *Test live*.

## Ejemplo real: Jamendo (built-in)

`local_adapters/jamendo.json` (modo `direct`):

```json
"api": {
  "countUrlTemplate": "https://api.jamendo.com/v3.0/tracks?format=json&limit=1&tags={genreId}&groupby=album_id&fullcount=true",
  "resultsPath": "results",
  "apiKeyRequired": true,
  "apiKeyField": "jamendo",
  "apiKeyParamName": "client_id"
},
"urlTemplates": {
  "page": "https://api.jamendo.com/v3.0/tracks?format=json&limit={pageSize}&offset={offset}&tags={genreId}&groupby=album_id&fullcount=true"
}
```

Con una clave `abc123` guardada, la URL final es:

```
https://api.jamendo.com/v3.0/tracks?format=json&limit=200&offset=0&tags=rock&groupby=album_id&fullcount=true&client_id=abc123
```

El usuario tiene que ir a **Settings → API Keys → jamendo** y pegar su `client_id`.

## Adapters custom (builder)

El builder soporta la declaración de API keys:

- **StepStructure** del wizard (`src/components/adapter-wizard/StepStructure.tsx:132-143`): un checkbox **"Requires API key"** (`apiKeyRequired`) y, al activarlo, dos campos:
  - **API key field** (placeholder `jamendo`) → `apiKeyField`
  - **Query param name** (placeholder `client_id`) → `apiKeyParamName`
- El asistente AI también lo genera: el prompt de creación de adapters incluye `apiKeyRequired` en el esquema JSON (`src/services/ai-prompt.ts:77`).
- El valor **no** se configura en el builder: como en los built-ins, cada usuario lo pone en *Settings → API Keys* bajo el `apiKeyField` indicado.

Los custom con clave funcionan igual que los built-in: ambos pasan por el mismo motor (`getFetchFunction`, `adapter-engine.ts:206`).

## Dónde conseguir el valor

### 1. Settings → API Keys (por usuario)

La vía universal y recomendada. Guarda cada clave en IndexedDB (`settings.apiKeys: Record<string, string>`):

- Sección **API Keys** en `src/pages/Settings.tsx:224`: un input por adapter ya declarado + botón **"+ Add API key"** para claves sueltas (`newAdapterName` / `newAdapterKey` → `update({ apiKeys: ... })`).
- Es **por usuario y navegador**: cada visitante de una instancia pública usa su propia clave. Nada viaja al servidor.

### 2. Env (seed de primera ejecución)

Pensado para instancias privadas (self-host/Docker) que quieren dejar la app preconfigurada. Se hornea en el build y se siembra solo **la primera vez** que el navegador no tiene settings guardados:

```bash
# Formato 1: JSON (ideal para Docker)
VITE_DEFAULT_API_KEYS={"jamendo":"abc123"}

# Formato 2: una var por campo (cómodo en .env / Vercel)
VITE_API_KEY_JAMENDO=abc123
```

- Implementación: `envApiKeys()` en `src/stores/settings.ts` lee ambos formatos (las vars `VITE_API_KEY_*` tienen prioridad sobre el JSON) y las mezcla en `apiKeys` solo en la rama "sin settings guardados" del `load()`.
- En cuanto el usuario guarda Settings, sus valores ganan y el env deja de influir.
- En Docker: `docker build --build-arg 'VITE_DEFAULT_API_KEYS={"jamendo":"abc123"}' -t scrp-music .`, o en `.env` + `docker compose up -d --build` (compose mapea las `VITE_*` a build args automáticamente).

## Seguridad

- **Las `VITE_*` terminan en el bundle JS**, visible para cualquiera que abra la página. Nunca pongas secretos reales ahí.
- **Apto para env** cuando la instancia es privada/self-host, o la clave **no es secreta** (el `client_id` de Jamendo es público por diseño).
- **Para instancias públicas**, usa *Settings → API Keys*: la clave queda solo en el navegador del usuario.
- El seed por env es *opcional y de conveniencia*: si no hay `VITE_DEFAULT_API_KEYS` ni `VITE_API_KEY_*`, todo funciona igual (cada usuario pone su clave).

## Archivos implicados

| Archivo | Papel |
|---------|-------|
| `local_adapters/jamendo.json` | Ejemplo built-in con `apiKeyRequired` |
| `src/components/adapter-wizard/StepStructure.tsx` | Formulario del builder (declaración de key) |
| `src/services/ai-prompt.ts` | Generación AI de adapters (incluye `apiKeyRequired`) |
| `src/services/adapter-engine.ts` | Lectura de la clave e inyección del query param |
| `src/services/adapter-tester.ts` | Detección de clave faltante (`apiKeyMissing`) |
| `src/pages/Settings.tsx` | UI de gestión de claves por usuario |
| `src/stores/settings.ts` | Store; `envApiKeys()` para el seed desde env |
| `.env.example` / `Dockerfile` / `docker-compose.yml` | Cómo pasar las claves en build/Docker |
