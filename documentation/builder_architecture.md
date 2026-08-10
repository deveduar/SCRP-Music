# Builder de adaptadores — Arquitectura

> Documento técnico. Para la guía de usuario en español (con ejemplo paso a paso) ver `builder_guide.md`.

## Visión general

El builder permite definir "adaptadores" de scraping sin código. Un adaptador es un objeto
`AdapterDefinition` (JSON) que describe **qué** scrapear (géneros), **cómo llegar** (URLs,
transporte), **cómo paginar** y **cómo convertir** cada ítem/HTML en un `Release`.

Hay dos caminos para llegar a una definición:

```
Camino manual (wizard)
Adapters.tsx (form state)
  → formToDefinition()        → AdapterDefinition
  → validateAdapterDefinition → AdapterParseResult (ok / errors)
  → testAdapter()             → AdapterTestResult  (Test live)
  → saveCustomAdapter()       → IndexedDB (local_adapters)
  → registerAdapter()         → scraper store (usa createAdapterFromDef)

Camino IA (copy-prompt)
AiSourceForm (Listing URL + Detail URL + opciones)
  → fetchRawText()            → texto crudo de la página/API (direct → relay → proxy)
  → makeSample()/makeDetailSample() → muestra anclada al contenedor / ítems
  → analyzePage() + buildHintsText() → STRUCTURE HINTS (selectores, géneros, JSON-LD…)
  → buildAiPrompt()           → prompt copiable (schema + sample + hints + hard rules)
  → [la IA devuelve el JSON del adaptador]
  → pasted en Advanced / wizard → validateAdapterDefinition → testAdapter → save
```

## Archivos clave

| Archivo | Rol |
|---|---|
| `src/types/adapter-definition.ts` | Tipo `AdapterDefinition` (el JSON del adaptador) |
| `src/services/adapter-schema.ts` | Zod schema + `validateAdapterDefinition` + `parseAdapterJson` |
| `src/services/adapter-form.ts` | Estado del wizard (`AdapterFormState`) ↔ definición; templates y builtins |
| `src/services/adapter-field-meta.ts` | Catálogo de campos y estrategias de extracción (metadatos de UI) |
| `src/services/adapter-engine.ts` | Motor: `createAdapterFromDef`, `getFetchFunction`, paginación, extracción |
| `src/services/adapter-tester.ts` | `testAdapter` (Test live) |
| `src/services/adapter-registry.ts` | Registro de definiciones (builtins + custom) |
| `src/services/cors-proxy.ts` | Transporte: `fetchWithProxy` (proxy), `fetchDirectRelay` (relay), `isRelayAvailable` |
| `src/services/fetch-info.ts` | `getFetchInfo` — describe qué modo usa cada adaptador (UI) |
| `src/services/source-sample.ts` | Muestras: `makeSample`/`makeDetailSample`, `detectSampleKind`, `fetchRawText` |
| `src/services/page-extract.ts` | Análisis de página real: `analyzePage`, `buildHintsText`, `detectGenres` |
| `src/services/ai-prompt.ts` | `buildAiPrompt` — el prompt copiable (schema, extractores, hard rules) |
| `src/storage/db.ts` | Persistencia IndexedDB de adaptadores custom |
| `src/pages/Adapters.tsx` | Página: lista, wizard, JSON avanzado, test/save, `AiSourceForm` |
| `src/components/adapter-wizard/*` | Pasos del wizard (Basics…Test & Save) y `AiSourceForm` |

## El wizard y el "form"

Cada paso edita una parte de `AdapterFormState` (tipos en `adapter-form.ts`). Los pasos son
`Basics, Transport, Genres, Pagination, Structure, Urls, Fields, Test & Save`.

- `formToDefinition(form)` construye la definición. `definitionToForm(def)` hace el inverso
  (para editar/plantillas). `normalizeForm()` limpia estados inconsistentes.
- Los built-ins (`htmlTemplateForm`, `apiTemplateForm`, `emptyForm`) son plantillas de partida.
- Los extractores del formulario se traducen en `extractorFromForm` y se leen con `extractorToForm`.
  Los valores de UI `sha1-url | sha1-id | sha1-comp` corresponden a `source: urlRelease | identifier | composite`.

### Validación
`adapter-schema.ts` valida con Zod y produce `{ path, message }` por error (convención `camino.campo`).

### Flujo "JSON primero" (Advanced / Paste JSON)
El estado JSON vive en `Adapters.tsx` (no en el paso): `advanced`, `jsonText`, `jsonDirty`.

```
jsonParsed = parseAdapterJson(jsonText)          // cuando advanced && jsonDirty
useJson    = advanced && jsonDirty && jsonParsed.ok
effectiveDef    = useJson ? jsonParsed.def : def
effectiveValid  = validateAdapterDefinition(effectiveDef).ok
effectiveErrors = useJson ? jsonParsed.errors : formValidation.errors
```

Consecuencia: si el JSON pegado es válido, **Test live / Save / badge de cabecera usan el JSON**.
Si es inválido, los botones quedan desactivados con los errores del JSON visibles (no guarda una
versión rota). `StepTestSave` es un componente controlado que recibe ese estado por props.

## Motor (`adapter-engine.ts`)

`createAdapterFromDef(def)` produce un `ScraperAdapter` con:

- **`getFetchFunction(def)`** — elige el transporte del adaptador según `def.fetch.mode`:
  - `relay`: `fetchDirectRelay(relayBase, url)` — fetch server-side vía middleware
    `/api/relay` (Node). **Cuidado**: los sitios protegidos por Cloudflare lo rechazan con
    HTTP 403 "Attention Required" (el relay es un fetch server-side, sin cookies de navegador).
  - `direct`: `fetch(url, { headers, timeout })` del navegador — necesita CORS permisivo.
  - `proxy`: `fetchWithProxy(url)` — vía proxy CORS público (corsproxy.io) o el de Settings.
- **`detectMaxPages(genreId, …)`** según `def.pagination.detection`:
  - `html-last-page`: `detectMaxPagesFromFirstPageHtml` (regex sobre la página 1).
  - `binary-search`: `detectMaxPagesBinarySearch`.
  - `api-count`: `detectMaxPagesApiCount` — usa `countUrlTemplate` si existe, si no `buildPageUrl(page=1)`;
    lee `countFieldPath` y calcula `maxPage = ceil(total / pageSize)`. Si falla la petición → `maxPage=1`.
  - `client-side`: no detecta páginas; carga y filtra en memoria.
- **`scrape(...)`** itera géneros × páginas:
  - `api`: `buildApiUrl` → fetch → `JSON.parse` → status check (`statusFieldPath`) →
    **array de ítems**: `resultsPath ? getNestedValue(data, resultsPath) : data` (array-raíz).
    Ítems → `mapFieldsFromData`.
  - `html`: página por `buildPageUrl` → parseo DOM → `mapFieldsFromHtml`. `two-phase` visita la
    página del release para portada/descargas; `single-pass` solo lista.
  - `client-side`: una petición, filtro por género, `slice` por `startPage/endPage`.

### Extracción
`evaluateExtractor(extractor, ctx)` resuelve cada `FieldExtractor` sobre un contexto
`{ data, doc, urlRelease, baseUrl }`. `resolveCtxValue` busca primero en `data` (item API) y luego
en el propio contexto. Nota `sha1` con `source:'identifier'` resuelve
`compositeFields[0] ?? 'identifier'` (permite un campo fuente editable).

Catálogo de extractores (ver `EXTRACTORS_BLOCK` en `ai-prompt.ts` y `adapter-field-meta.ts`):
`apiField {field}` (soporta dotted paths) · `concat {template, fields}` ·
`selector {selector, attribute}` · `selectorText {selector}` · `regex {pattern, group}` ·
`titleParse {separator, artistSplit, stripTags}` · `urlPath {pattern, transform}` ·
`substr {source, start, end}` · `split {fields, delimiters}` · `hardcoded {value}` ·
`sha1 {source: urlRelease | identifier | composite, compositeFields}`.
Cada campo de UI (`title, artists, album, year, label, catalog, subgenres, coverUrl, urlRelease, …`)
expone su lista de estrategias ordenada en `FIELD_STRATEGIES`.

### URLs
- `buildPageUrl` sustituye `{page} {genreId} {query} {path}` (NO `{pageSize}`/`{offset}` para kind html —
  limitación conocida, ver "Fases futuras").
- `buildApiUrl` añade API key (`apiKeyParamName`), modo offset etc.

## Test live (`adapter-tester.ts`)

`testAdapter(def)`:
1. Crea el adapter, obtiene el primer género.
2. `detectMaxPages` (timeout 30s) → `maxPage` / `maxPageError`.
3. `scrape` página 1 (timeout 45s), recolecta hasta 5 muestras.
4. Resultado: `ok = hay género && (hay muestras || maxPage != null)`, más `samples`, `errors`,
   `apiKeyMissing`, `durationMs`.

`StepTestSave` analiza `testResult.errors`: si detecta `HTTP 403 | HTTP 429 | Cloudflare |
Attention Required` (`antiBotBlocked`) muestra un panel ámbar con botones **"Switch to CORS proxy"**
y **"Switch to direct"** (vía prop `onSetFetchMode`), y avisa de pulsar de nuevo "Test live".

## Persistencia y registro

- Custom → IndexedDB (`saveCustomAdapter`/`getCustomAdapter`/`deleteCustomAdapter`).
- `adapter-registry.ts` mantiene `getAllDefinitions()` (builtins + custom), `registerCustomDefinition`,
  `unregisterCustomDefinition`, y el override de builtins con el mismo id.
- Al guardar: se registra la definición, se crea el `ScraperAdapter`, se activa
  (`activeAdapterId` en Settings) y se refresca la lista.
- Borrado de un id built-in: re-registra la versión builtin.
- El wizard persiste un draft en `localStorage['adapter_wizard_draft']` (debounce 400ms) y se
  autoabre si existe.

## UI / seguridad
- `StepFields` usó en el pasado una prop llamada `key` (reservada por React y eliminada de props,
  causaba undefined → TypeError → pantalla negra). Ahora se llama `fieldKey`.
- `ErrorBoundary` (clase) envuelve `<Routes>` en `App.tsx` como red de seguridad de errores de render.
- `fetch-info.ts` (`getFetchInfo`) expone a la UI qué transporte usa cada adaptador
  (`direct | relay | proxy | unknown`), p. ej. para el badge de Settings.

## Muestras y prompt de IA (`source-sample.ts`, `page-extract.ts`, `ai-prompt.ts`)

### Obtención de la muestra
- `AiSourceForm` descarga una muestra de la Listing URL y (si se da) otra del Detail page URL.
  `fetchRawText` intenta **direct → relay (si `isRelayAvailable() !== false`) → proxy** y devuelve
  `{ text, mode }` con el camino real usado.
- `makeSample` (listing) / `makeDetailSample` (detail): si el texto es JSON → se trunca a 8 ítems;
  si es HTML → ancla la región al contenedor detectado (regresión: el menú de géneros en `<li>` ya no
  agota el presupuesto antes de los posts); el truncado es boundary-aware (`sliceCompleteItems` termina
  siempre en un ítem completo, con ≥2 ítems). Si la página es HTML pero no hay lista visible, se extrae
  JSON-LD `ItemList` o payload embebido (`__NEXT_DATA__`, `__NUXT__`…). Si nada → `shellDetected`
  (página JS-rendered).
- `SampleOptions.maxChars` (UI: "Sample size") limita el tamaño de cada muestra.
- `detectSampleKind` → `json | html | unknown`; `SourceSample.mode` registra el transporte real.

### Análisis de la página (`page-extract.ts`)
- `analyzePage` parsea con `DOMParser` (jsdom en tests): detecta bloques de ítems repetidos
  (≥3 con misma estructura, ignorando nav/footer/header/aside), selectores candidatos relativos al
  contenedor, JSON-LD, microdata, OpenGraph, feeds, URLs de audio/download y enlaces de paginación.
  La firma de los bloques ignora clases "ruido" (post-IDs, `category-*`, `tag-*`, `artist-*`,
  `record_label-*`, flags de WordPress) para que ítems con clases distintas por post se agrupen.
- `detectGenres(doc, baseUrl)` lee la navegación del sitio (nav/header/menús) sobre el HTML crudo y
  extrae candidatos con su slug real (`label` + último segmento de la URL, p. ej.
  `Drum & Bass (DnB)` → `/genre/drum-bass/`; descarta labels/artists/tags, utilidades y enlaces de
  paginación numéricos). `deriveGenrePathFromUrl(baseUrl)` detecta si la Listing URL es una página de
  género (p. ej. `/genre/new-techno/` → patrón `/genre/{genreId}/`) y se cruza con los candidatos del
  mismo prefijo.
- `buildHintsText` → bloque `STRUCTURE HINTS` con selectores candidatos, géneros (con URL real resuelta,
  no la plantilla `{id}`) y patrón de URL.

### El prompt (`buildAiPrompt`)
- `AiSourceInput` transporta `url, detailUrl, kind, sampleText, sampleKind, sampleMode,
  sampleNote, sampleTransport, detailSample*, hints, detailHints, maxChars, notes, apiKeyHint, headers`.
- El transporte real se conoce **antes** de pedir respuesta: `AiSourceForm` guarda
  `sampleTransport: listing.mode` y `detailSampleTransport: detailSample.mode`, y el prompt lo espeja
  en `Sample transport: … — fetch.mode MUST mirror it`.
- Bloques del prompt: `SCHEMA_BLOCK` (v1.0), `EXTRACTORS_BLOCK`, `SAMPLE_GUIDANCE`, `HARD_RULES`
  (13 reglas) y `=== MY SOURCE ===` con `REAL DATA SAMPLE`, `DETAIL PAGE SAMPLE`, `STRUCTURE HINTS`
  y un guardrail si no hay URL ni muestra.
- `TRANSPORT_RULES`: `fetch.mode` debe ser idéntico al transporte de la muestra (direct→direct,
  relay→relay, proxy→proxy); **no** asumir "relay" por defecto para HTML (el relay es server-side y
  Cloudflare lo rechaza con 403); solo elegir otro modo si el transporte no se conoce.
- HARD RULE 13: igual mandato (mirror del transporte). Otras reglas clave: nunca inventar URLs/baseUrl,
  no añadir `statusFieldPath` sin status real, array-raíz → `resultsPath` vacío, `downloads` solo si hay
  evidencia, `id` estable vía sha1, `lastPageRegex` obligatorio con `html-last-page`, output solo JSON.
  HARD RULE 14 + guidance de géneros: copiar el slug **literal** de `STRUCTURE HINTS` (p. ej.
  `Drum & Bass (DnB)` → `drum-bass`, no `drum-bass-dnb`); nunca re-derivar el path desde la label.
- `testGenres` (`adapter-genre-tester.ts`): comprueba la URL de página 1 de cada género (transporte del
  adapter) y reporta OK/HTTP/error — botón **Test genres** en el wizard junto a Test live, con selector
  de alcance (All / 10 / 1).
- Tests: `npm test` (vitest + jsdom), `src/services/source-sample.test.ts` (25 casos:
  kind detection, región lista/sidebar, truncado boundary-aware, JSON-LD, shells, géneros, hints,
  regresión de agrupado de ítems de WordPress con clases ruidosas).

## Limitaciones conocidas y fases futuras
- `buildPageUrl` no sustituye `{pageSize}` ni `{offset}` para kind html; para offset real hace falta
  `api.countUrlTemplate` (solo se usa en `api-count`) y `mode:offset` pendiente en el motor.
- Validación por paso individual (no solo global al final).
- Selector de extracción en vivo / integración de IA dentro de la app.
- AI helper actual: solo genera un prompt copiable (sin llamada a API).
