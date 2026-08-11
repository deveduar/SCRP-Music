# Guía no-code: crea tu primer adaptador

El **builder de adaptadores** (página **Adapters**) te permite conectar una fuente nueva
(un blog de música, una API de discos…) sin escribir código. Se configura con formularios,
se prueba en vivo y se guarda en tu navegador (IndexedDB). No se toca ningún fichero del proyecto.

El botón **New** del panel **Definitions** (a la derecha de Export/Import) — o la propia página cuando no
hay ningún borrador — abre una pantalla de inicio con las opciones para crear un adaptador:

1. **Generate with AI** — pegas la URL del listado, la app descarga una muestra real y genera un
   prompt copiable para la IA (abre el wizard con el generador IA ya expandido).
2. **Start from scratch** (o plantillas **HTML**/**API**) — rellenas el formulario a mano o desde una
   plantilla predefinida.
3. **Paste JSON** — pegas un JSON de adaptador (p. ej. el generado por una IA) y lo validas/guardas.
4. **Use as template** (desde la lista) — copias un adaptador existente (built-in o tuyo) y lo adaptas.

---

## Estructura del editor

El editor se divide en dos bloques verticales:

1. **Panel principal** (orden, de arriba a abajo): validación, **Adapter overview**,
   **JSON editor** (colapsable, cerrado por defecto), fila de acciones
   **[Generate with AI]** + **[Paste from clipboard]**, panel de IA (formulario de fuente y
   prompt colapsado), y los botones **Test live**, **Test genres** y **Save adapter**.
2. **Advanced** (colapsable, cerrado por defecto): el formulario completo con sub-pestañas
   **Form** y **Field Mapping**.

---

## 1. Panel principal

Es el panel que ves al abrir el editor.

### Generador con IA
**Generate with AI** te pide lo mínimo: la **URL del listado** (la página o API que
muestra los releases) y, opcionalmente, la **URL de una página de ítem** (un release suelto). Pulsa
**Download samples** y la app descarga una **muestra real** de cada URL (intenta directo → relay →
proxy) y las mete en el prompt. La IA **analiza los datos reales** y decide ella la estructura: `kind`,
`resultsPath`, selectors, campos, paginación y descargas.

El prompt generado aparece **colapsado** bajo el desplegable **"Show prompt"**, debajo del formulario
de la fuente; ábrelo para copiarlo.

- No necesitas saber nada técnico: solo la URL del listado (y opcionalmente la de un ítem suelto, o
  notas en tus palabras).
- La app **filtra el HTML antes de meterlo en el prompt**: quita menús de navegación, cabeceras,
  scripts y hojas de estilo, localiza el **contenido principal** y recorta la **lista real de ítems**
  (2 o más releases completos con su contenedor). Para la página del ítem recorta el **artículo**
  completo (portada, título, y enlaces de descarga si los hay). La IA recibe solo lo útil, no el HTML
  entero de la página.
- Si la app **no puede alcanzar la URL** (CORS, requiere login…): abre la página, pulsa **F12 →
  Network** y pega el HTML/JSON en «Paste the page HTML/JSON instead» — mismo resultado.
- **Sitios renderizados con JavaScript**: si la muestra es solo la cáscara (cabecera, sin lista), la
  app te avisa con un aviso ámbar. Usa entonces una **URL que muestre la lista** (una playlist, una
  página de listado o de búsqueda), o pega el JSON de **F12 → Network → Fetch/XHR**. En páginas que sí
  renderizan la lista en el HTML, la app localiza los ítems automáticamente; si además llevan datos
  embebidos, los extrae para el prompt.
- **Advanced (opcional)**: tipo, API key y headers, por si sabes más.
- El prompt incluye reglas duras: nunca inventar URLs, solo campos que existen en la muestra,
  `statusFieldPath` solo si la API tiene campo real, sin paginación → `client-side`, etc.
- **El transporte de la muestra se refleja en el prompt**: la app recuerda cómo descargó la muestra
  (direct / relay / proxy) y obliga a la IA a poner `fetch.mode` igual a ese transporte — así el
  adaptador usa el mismo camino que ya funcionó al descargar la muestra.

**No copies el prompt sin URL ni muestra**: el botón queda desactivado con un aviso. Pásalo a
cualquier IA (ChatGPT, Claude, DeepSeek…), la IA devuelve el JSON del adaptador, y lo pegas en el
editor. La app no llama a ningún API de IA: el prompt viaja solo en tu portapapeles.

### Validación
La barra de estado muestra **Definition is valid** (verde) o la lista de errores (camino + mensaje).
Los botones **Test live** y **Save adapter** se activan solo si la definición es válida.

### Editor JSON
El **JSON editor** es un desplegable (chevron, cerrado por defecto). A su lado, en la fila de acciones,
vive **Paste from clipboard**, **siempre visible** (funciona aunque el editor esté cerrado): lee el
JSON del portapapeles, abre el editor y lo pega (si el navegador no lo permite, enfoca el editor para
que pegues con Ctrl/Cmd+V).
- Si lo **editas**, la validación se calcula sobre tu JSON: si es válido, **Test live** y **Save**
  usan TU JSON y la barra se pone verde.
- **Auto-sync**: un JSON válido que pegues/edites **se carga automáticamente en los formularios
  de abajo**. Después puedes seguir editándolo a mano. Regla «lo que editas por última vez gana»:
  si tocas un campo del formulario, el JSON se regenera desde el formulario.
- El botón **Paste JSON** de la pantalla inicial te lleva directo aquí.

> Si el JSON pegado tiene errores, verás la lista exacta y los botones quedarán desactivados hasta
> corregirlo — no guardará una versión rota.

### Resumen
Justo debajo de la validación aparece **Adapter overview**: un vistazo compacto del adaptador (tipo,
transporte, géneros, paginación, campos y descargas). Se actualiza en vivo y sirve para verificar de
un vistazo lo que se va a guardar.

### Test & Save
- **Test live**: scrapea el primer género / primera página (máx. 5 releases). Comprueba detección de
  páginas, muestras y errores.
  - El resultado muestra la **URL real de la página 1** (clic para abrirla) y, si no hay muestras,
    un **preview de la respuesta** — así ves si el `resultsPath`, el `query` del género o la propia
    URL están mal.
  - **0 releases = test fallido** (ya no sale en verde): el test solo es válido si obtiene muestras.
  - Errores útiles: `0 items at resultsPath "…"` (ruta al array mal), «respuesta no es un array»
    (faltaría `resultsPath`), HTTP con URL (`HTTP 525 (https://…)`, típico de una URL inventada),
    y aviso de `statusFieldPath` inexistente.
  - **Anti-bot / Cloudflare**: si el error es `HTTP 403`, `HTTP 429`, `Cloudflare` o
    «Attention Required», la app muestra un panel ámbar con botones **"Switch to CORS proxy"** y
    **"Switch to direct"** — el modo relay usa un fetch server-side que Cloudflare rechaza con 403.
    Cambia de modo y pulsa **Test live** otra vez.
- **Test genres**: comprueba la **URL de página 1 de cada género** usando el transporte del adaptador.
  Selector de alcance **All / 10 / 1** (por defecto 10). Reporta un resumen (n ok / n fallidos) y cada
  género con su URL real (clic para abrirla) y estado (`OK` / `HTTP <n>` / `error`). Detecta géneros
  rotos antes de scrapear — típico de un slug adivinado por la IA en vez de copiado literal
  (p. ej. `drum-bass-dnb` cuando la URL real es `/genre/drum-bass/`).
- **Save adapter**: guarda en tu navegador y lo activa.

### Borrador, sesión y cambios sin guardar

Mientras el editor está abierto, todo el estado del wizard se **auto-guarda como borrador**
(`localStorage`) a los pocos segundos de cada cambio: formulario, editor JSON, los datos del
**generador con IA** (URLs de listing/ítem, muestras descargadas o pegadas), y el contexto de la sesión
(si estás **creando** o **editando** un adaptador, y si el editor JSON / panel IA estaban abiertos). Por
eso puedes cerrar la pestaña, recargar o irte a otra página y volver — el editor se reabre exactamente
donde lo dejaste: si estabas **editando** un adaptador, vuelve como **«Edit «nombre»»** (sin botón
Close, con el adaptador resaltado en la lista), y si estabas **creando**, como adaptador nuevo.

Editar (**Edit**) o usar **Use as template** carga una **copia de trabajo** en el editor y **no** cambia
el adaptador activo: el badge **Active** de la lista solo cambia al pulsar **Save adapter** (guarda y
activa). Mientras tanto puedes alternar entre editables sin problema, pero:

- El chip **«Sin guardar»** (ámbar) aparece en la cabecera del editor mientras haya cambios que aún no
  has guardado; desaparece al guardar y vuelve si vuelves a editar.
- Si intentas **cerrar o recargar** la pestaña con cambios sin guardar, el navegador te avisa antes de
  salir (el borrador se escribe al momento, así que nada se pierde).
- Si intentas **saltar a otro adaptador** (Edit, Use as template) o pulsar **New** con cambios sin
  guardar, la app te pregunta antes de descartarlos.
- El botón **Close** (X) de la cabecera descarta el borrador y vuelve a la pantalla de inicio — solo
  aparece al **crear** un adaptador nuevo; al **editar** uno existente no se muestra, porque cerrar
  descartaría la edición (se sale guardando o navegando).

---

## 2. Advanced

Sección colapsable (cerrada por defecto) con el formulario completo en dos sub-pestañas.

### Form
Todos los grupos del formulario:

- **Basics / Transport**: Name, id (con aviso de colisión), Type, Base URL y modo de petición.
  Regla rápida del transporte:

  | Modo | Para qué | Cuándo |
  |---|---|---|
  | `Direct` | APIs con CORS abierto (Open Library, JSONPlaceholder) | siempre que puedas. No depende de terceros |
  | `CORS proxy` | Sitios que bloquean el fetch del navegador pero permiten un proxy CORS | por defecto; también para webs HTML protegidas (p. ej. Cloudflare) |
  | `Relay` | Sitios que bloquean proxies CORS pero permiten fetch server-side | solo si un test por proxy/direct falla por CORS. **Ojo**: los sitios con Cloudflare rechazan el relay con HTTP 403 |

  Regla práctica: si un `Test live` de una web HTML falla con **HTTP 403 / Cloudflare /
  «Attention Required»**, cambia a **CORS proxy** (o **Direct** si el navegador puede) — el relay es
  un fetch server-side y Cloudflare lo bloquea. Usa **Relay** solo para sitios que bloquean el CORS
  del navegador pero permiten peticiones desde servidor.
- **Genres**: Fixed list (id, label, `path`/`query`) o **Dynamic** (URL + regex, con fallback).
  - `path` se sustituye en `{path}`, `query` en `{query}` de las URLs.
- **Pagination (completo)**: detección y modo.
  - **Last page in HTML** (`html-last-page`): busca el número de página mayor con un regex. Rápido, solo HTML.
  - **API total count** (`api-count`): APIs que devuelven el total (necesitas el campo, p. ej. `numFound`).
  - **Client-side**: cargas todo de una vez y filtras.
  - **Binary search**: sin marcadores de página (lento; de reserva).
  - Modo **Page number** → la URL debe contener **`{page}`**; modo **Offset** → **`{offset}`**.
    En **APIs** el motor sustituye además `{pageSize}` y `{offset}` (p. ej. `/chart?limit={pageSize}&index={offset}`).
    En **HTML** no los sustituye: usa solo `{page}`.
- **Structure (API)**: Results path (déjalo **vacío si la respuesta YA es un array**), API key,
  detección de errores, etc.
- **Structure (HTML)**: Release container, selectores de título/enlace, «next page» y selectores
  de detalle (portada y descargas).
- **URLs**: Page URL (con `{genreId}`, `{path}`, `{query}`, `{page}`, `{offset}`), First page URL
  y Search URL, con **preview en vivo** de la página 1 y 2.

### Field Mapping
Cada campo del release. Activa solo los que la fuente proporciona. Estrategias útiles:
- **Hash of identifier** (`sha1-id`): ID estable para APIs. El campo fuente es editable;
  vacío usa `identifier`. Si tus ítems tienen un campo único (p. ej. `key`, `id`), escríbelo ahí.
- **Hash of combined fields**: para URLs o combinaciones.
- **API field**: lee un campo del JSON del ítem (admite rutas anidadas).
- **Build from fields**: monta URLs con `{0}`, `{1}…`.
- **Split into list**: para subgéneros/tags separados por comas o barras.

**Hardcoded values (abajo)**: valores fijos para TODO release de la fuente (p. ej. un solo artista).
Es distinto de la estrategia «Fixed value» de un campo individual. Uno gana sobre lo otro si coinciden:
usa la estrategia por campo para un valor puntual y la sección para valores globales.

---

## Errores comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `HTTP 403` / `Cloudflare` / `Attention Required` en el test | el relay (fetch server-side) lo bloquea Cloudflare | Cambia el transporte a **CORS proxy** o **Direct** (panel ámbar de Test live) |
| `HTTP 525 (https://…)` en el test | la URL no existe (p. ej. inventada por la IA) | Abre la URL de la página 1 que muestra el test; corrige `baseUrl`/URLs |
| `0 items at resultsPath "…"` | la ruta al array está mal | Pon la ruta real (p. ej. `results`, `docs`) o déjala vacía si es array raíz |
| `0 items at the response root` | la respuesta es un objeto, no un array | Define `resultsPath` con su campo array |
| `API error: status undefined` | `statusFieldPath` de una API que no tiene ese campo | Elimina `statusFieldPath`/`statusSuccessValue` del JSON |
| API: falla CORS | sin CORS | `CORS proxy` o `Direct` si es abierto |
| Solo página 1, no detecta el resto | `html-last-page` sin regex o regex mal | Regex correcto `page/([0-9]+)/` |
| `api-count` da `maxPage=1` | campo de total mal | Ajusta `countFieldPath` (p. ej. `numFound`) |
| Género da 404 al scrapear (p. ej. `drum-bass-dnb` en vez de `drum-bass`) | el slug se re-derivó de la label en vez de copiarse | Usa **Test genres** para localizar el género roto; copia el slug **literal** (de `STRUCTURE HINTS` o del nav del sitio) |
| ID duplicados en cada scrape | id basado en datos que cambian | Usa `sha1-id` sobre un campo único estable |

## Notas técnicas breves
- Los adaptadores guardados viven en **IndexedDB** (custom) y pueden sobreescribir built-ins con el
  mismo id (te avisa antes).
- `supportsFastSkipExisting` permite saltar releases ya scrapeados.
- El límite de `maxPagesCap` protege la detección (default 5000).
- Detalle interno: en **APIs**, `buildApiUrl` sustituye `{page}`, `{offset}`, `{pageSize}`, `{query}`, `{genreId}` y `{path}`. En **HTML**, `buildPageUrl` solo sustituye `{page}`, `{query}`, `{genreId}` y `{path}` (sin `{offset}`/`{pageSize}`).
- Tus JSON de adaptadores de ejemplo están en `local_adapters/` y se pueden usar como plantilla con **Use as template**.

---

# Ejemplo: Open Library

Fuente de prueba: **Open Library** (API pública, sin API key, CORS abierto).
Este adaptador NO está incluido en la app: se crea manualmente desde la página **Adapters**.

## Cómo probar

1. Arranca `npm run dev` y abre la página **Adapters**.
2. Pulsa **"Start from scratch"** (o **API template**) y rellena los pasos con los valores de abajo.
3. En el último paso pulsa **Test live** y luego **Save adapter** (quedará activo y visible en Scraper).

## Valores paso a paso

### Paso 1 — Basics
- Name: `OpenLibrary Music`
- Adapter id: `openlibrary`
- Description: `Books about music from the Open Library search API`
- Type: `JSON API`
- Base URL: `https://openlibrary.org`
- Fast-skip: ON

### Paso 2 — Transport
- Mode: `Direct`
- Timeout (ms): `30000`
- Headers: `Accept` → `application/json`

### Paso 3 — Genres
- Source: `Fixed list`
- Añade una fila: Label `Music` · id `music` · path *(vacío)* · query `music`

### Paso 4 — Pagination
- Detection: `API total count`
- Mode: `Page number`
- Page size: `20`
- Max pages cap: `200`
- Total count field path: `numFound`

### Paso 5 — API Options
- Results path: `docs`
- Status / Error / API key: vacío

### Paso 6 — URL Templates
- Page URL: `/search.json?q={query}&page={page}`
- First page: vacío · Search: vacío

### Paso 7 — Field Mapping

| Campo | Estrategia | Valores |
|---|---|---|
| ID | Hash of combined fields | Fields: `key` |
| Title | API field | Field: `title` |
| Artists | API field | Field: `author_name` |
| Year | API field | Field: `first_publish_year` |
| Subgenres | Split into list | Fields: `subject` |
| Cover | Build from fields | Template: `https://covers.openlibrary.org/b/id/{0}-M.jpg` · Fields: `cover_i` |
| Release URL | Build from fields | Template: `https://openlibrary.org{0}` · Fields: `key` |
| Album, Genre, Label, Catalog, Stable identity | *(off)* | — |

### Paso 8 — Test & Save
- **Test live** → "Adapter responds" + samples.
- **Save adapter** → queda activo y listo para usar en Scraper.

## Atajo 1: pegar el JSON y guardar directo

En la página **Adapters** pulsa **Paste JSON**: se abre el paso Test & Save con el editor JSON
listo. Pega el JSON de abajo → se valida al instante (barra verde) → **Test live** y **Save adapter**
funcionan con tu JSON, sin tocar el formulario.

## Atajo 2: pegar el JSON en el editor → el formulario se rellena solo

En el panel principal abre **Show JSON editor** (o usa **Paste from clipboard**) y pega el JSON. Un
JSON válido se **carga automáticamente en el formulario del wizard** (auto-sync): los pasos de
Advanced quedan rellenos. Regla «lo que editas por última vez gana»: si después tocas un campo del
formulario, el JSON se regenera desde el formulario.

```json
{
  "version": "1.0",
  "id": "openlibrary",
  "name": "OpenLibrary Music",
  "description": "Books about music from the Open Library search API",
  "kind": "api",
  "baseUrl": "https://openlibrary.org",
  "supportsFastSkipExisting": true,
  "fetch": { "mode": "direct", "timeout": 30000, "headers": { "Accept": "application/json" } },
  "genres": { "source": "hardcoded", "items": [ { "id": "music", "label": "Music", "path": "", "query": "music" } ] },
  "pagination": { "detection": "api-count", "mode": "page-number", "pageSize": 20, "maxPagesCap": 200, "countFieldPath": "numFound" },
  "scrapeMode": "single-pass",
  "api": { "resultsPath": "docs", "countFieldPath": "numFound" },
  "urlTemplates": { "page": "/search.json?q={query}&page={page}" },
  "fieldMapping": {
    "id": { "from": "sha1", "source": "composite", "compositeFields": ["key"] },
    "title": { "from": "apiField", "field": "title" },
    "artists": { "from": "apiField", "field": "author_name" },
    "year": { "from": "apiField", "field": "first_publish_year" },
    "subgenres": { "from": "split", "fields": ["subject"] },
    "coverUrl": { "from": "concat", "template": "https://covers.openlibrary.org/b/id/{0}-M.jpg", "fields": ["cover_i"] },
    "urlRelease": { "from": "concat", "template": "https://openlibrary.org{0}", "fields": ["key"] }
  },
  "hardcodedFields": { "source": "openlibrary" }
}
```

## Notas

- La URL usa `{query}` (sin `{pageSize}`) porque la detección `api-count` actual usa
  `buildPageUrl`, que no sustituye `{pageSize}`. Eso se resolverá en una fase futura con
  `api.countUrlTemplate`.
- Si un documento no tiene `cover_i`, la URL de portada quedará incompleta (no rompe el test).
- Si la respuesta de la API fuese un array directo (p. ej. JSONPlaceholder), deja **Results path**
  vacío: el motor usa el array raíz como ítems.
- ¿Quieres generar el adaptador con IA? En Test & Save usa **Generate with AI**: copia el prompt,
  describe tu fuente y pega el JSON resultante en el editor.
