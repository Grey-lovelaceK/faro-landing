# Faro° — Estudio web, marketing y posicionamiento (SEO · AEO · GEO)

Contexto del proyecto para Claude Code. Léelo antes de trabajar.

## Qué es
Landing + herramientas de un estudio digital chileno (dos socios). Servicios: diseño/desarrollo web,
marketing y posicionamiento SEO/AEO/GEO. **Diferenciador central:** que al cliente lo encuentren en
Google **y en las respuestas de la IA** (ChatGPT/Perplexity/AI Overviews) — AEO/GEO, casi nadie lo ofrece.

## Marca y negocio
- **Nombre:** Faro° (placeholder, faro = te encuentran). Se puede cambiar.
- **Socios:** Cristian Revilla (analista programador, Ing. Informática — dev/datos/SEO técnico) +
  socia graduada en marketing y redacción (estrategia/contenido/copy).
- **Contacto:** contacto@faroagencia.cl (Google Workspace; SPF, DKIM y DMARC configurados en Cloudflare DNS).
- **Etapa:** recién empezando, SIN portafolio/testimonios todavía. Estrategia comercial: puerta a puerta
  en Macul + auditoría gratis como gancho. **NO poner en la web mensajes de "recién empezando"** (resta
  confianza) ni clientes/testimonios inventados. Honestidad total: solo datos reales y verificables.
- Dominio: **faroagencia.cl**, activo (responde con la landing desde Cloudflare, 26-sep-2026). faro.cl está tomado.

## Stack e infraestructura
- **Sitio estático** (HTML/CSS/JS vanilla, SIN framework). No React, no build step.
- **Hosting:** **Cloudflare Pages**, proyecto `faro-landing` (migrado el 26/27-sep-2026). Repo GitHub: `Grey-lovelaceK/faro-landing`.
  **Deploy = `git push origin main`** (rama de producción de Pages desde el 27-sep-2026; vista previa de ramas desactivada).
  La rama `cloudflare` ya no existe.
- **URL prod:** https://faroagencia.cl (+ `www`). La vieja `faro-landing-alpha.vercel.app` responde 308 → faroagencia.cl
  (redirect en `vercel.json`); Vercel queda solo de redirector hasta darlo de baja.
- **Backend:** `/api/*.js` con firma estilo Vercel (`export default handler(req,res)`, `fetch` global). En Cloudflare
  corren vía `functions/api/*.js` + `cf/adapter.js`. NO se usa Render ni servidor aparte.
- **DNS:** Cloudflare (`miki`/`tadeo.ns.cloudflare.com`, delegado en NIC Chile). Correo = registros MX/SPF/DKIM/DMARC ahí.
- `vercel.json` → `cleanUrls` + redirect total a faroagencia.cl. Pages hace URLs limpias por defecto.
- **Cloudflare Pages (prod):** `functions/api/*.js` envuelve los mismos `api/*.js` con `cf/adapter.js`; `cf/build.mjs` publica solo una allowlist de la raíz en `dist/`. Detalle en `cf/README.md`.

## Mapa de archivos
- `index.html` — landing (hero con "respuesta de IA" animada, servicios, visibilidad IA, proceso, equipo,
  precios, CTA). **OJO:** se edita a mano acá directo (ya no hay archivo fuente externo).
- `analiza.html` — página `/analiza`: analizador de web (form + resultados + puerta de leads).
  Todo el JS del analizador vive inline al final del archivo.
- `api/analyze.js` — baja el HTML de una URL y evalúa 21 checks SEO/social/AEO-GEO/técnico (score 0-100). Sin keys.
- `api/pagespeed.js` — rendimiento real vía Google PageSpeed Insights (lab Lighthouse + campo CrUX).
- `api/aicheck.js` — chequeo real de IA (¿te citaría un asistente?) vía Gemini con JSON forzado.
- `api/lead.js` — `POST` captura de lead (name, email, url, score) → tabla `leads`.
- `api/leads.js` — vista protegida por clave: tabla HTML + export CSV.
- `api/_db.js` — helper de conexión Neon + `ensureSchema()`. El `_` evita que Vercel lo enrute.
- `integraciones.html` — página `/integraciones`: servicio tienda ↔ ERP ↔ courier, con packs y precios.
- `cf/`, `functions/api/` — deploy en Cloudflare Pages (ver arriba).
- `tools/prospectar.js` — **interno, no se despliega**: lista negocios sin web por rubro y comuna (Google Places). Salida en `tools/out/` (gitignored).
- `maqueta/plantilla.{css,js}` — motor de maquetas para prospectos; los datos de cada prospecto (`maqueta/*/`) están gitignored.
- `vercel.json`, `.vercelignore`, `package.json` (única dep: `@neondatabase/serverless`; script `build:cf`), `README.md`.

## Variables de entorno (secretos en Cloudflare Pages → Configuración → Variables y secretos; ninguna en el repo)
Neon propio (proyecto "Faro Agencia", São Paulo), no el de la integración de Vercel.
| Var | Para qué | Si falta |
|---|---|---|
| `STORAGE_DATABASE_URL` (o `STORAGE_POSTGRES_URL` / `DATABASE_URL` / `POSTGRES_URL`) | Neon Postgres | `/api/lead` y `/api/leads` responden 500 |
| `LEADS_PASSWORD` | clave de `/api/leads?key=` | 500 |
| `GEMINI_API_KEY` | chequeo de IA | el bloque de IA se degrada con mensaje, no rompe |
| `GEMINI_MODEL` | opcional, default `gemini-3.8-flash` (2.0 y 2.5 retirados para cuentas nuevas, sep-2026) | usa el default |
| `PAGESPEED_API_KEY` | opcional, sube la cuota de PSI | funciona con cuota baja |

Todos los endpoints degradan con mensaje en español si falta su key — nunca revientan la página.

## Convenciones de diseño (mantener consistencia)
- **Fuente única: `DESIGN.md`** (tokens de ambos temas, tipografía, componentes, do/don't, sacados del CSS real). No copies la paleta acá.
- Concepto en una línea: faro de noche → navy + cobalto. Nada de cream+coral ni tonos cálidos. Ambos temas por tokens; respetar `prefers-reduced-motion`.
- Idioma: español de Chile, tono confiado y directo. Copy honesto, específico, sin humo.

## Analizador — estado real (actualizado 2026-07-31)
**Todo esto YA está en prod:**
- **v1 — 21 checks** (`api/analyze.js`): SEO (title, meta, H1, HTTPS, canonical, lang, viewport),
  Social (OG ×3, Twitter), AEO/GEO (JSON-LD, llms.txt, profundidad, FAQ), Técnico (status, TTFB,
  robots, sitemap, favicon, alt). Score = suma ponderada (pass=peso, warn=½ peso) → nota A–E.
- **v2.1 — captura de leads** (`c80f162`): Neon Postgres, tabla `leads`, vista `/api/leads?key=`.
- **v2.2 — PageSpeed real** (`73309b9`): Core Web Vitals lab + campo.
- **v2.3 — chequeo de IA** (`39b4584`): Gemini free tier, veredicto AEO con acciones.

**Pendiente / decidido que no:**
- **Headless propio** (`@sparticuz/chromium`): NO se hace. PSI ya renderiza con Chrome y cubre SPAs.
- Lo que quede por hacer vive en `.claude/context/PROJECT.md` → sección "Backlog".

## Equipo de agentes
Lee la ficha completa en `.claude/context/PROJECT.md`. Resumen de a quién llamar:
- **architect** (global) — planifica, descompone, audita. Líder por defecto.
- **faro-dev** (`.claude/agents/`) — construye. En este repo reemplaza al `tech-lead` genérico.
- **faro-copy** — copy es-CL y conversión. Asiste a la socia: ella es la autoridad de marca y copy.
- **faro-estrategia** — oferta, precios, prospección, contenido para redes, métricas del embudo. También asiste a la socia.
- **faro-aeo** — audita SEO/AEO/GEO y mantiene la rúbrica del analizador.
- **faro-qa** — verifica en prod; no escribe código de producción.
- **data-guru / dba** (globales) — solo bajo demanda; una tabla no justifica guardianes fijos.

## Reglas
- Cambios aditivos, sin romper lo que funciona. Copy 100% honesto (nada de clientes/números falsos).
- Verificar en prod tras cada push (`faroagencia.cl`).
- **Push a `main` = publicar** (rama de producción de Pages). Solo lo hace Cristian (o su sesión cuando él lo pide).
  Cualquier otro trabajo va en una rama y se revisa en la URL de preview de Cloudflare Pages.
- UI: usar el skill `impeccable` (en `.claude/skills/`), que carga `DESIGN.md` y `PRODUCT.md`.
- Secrets (API keys, DB) → variables de entorno del hosting (Pages; Vercel mientras siga vivo), NUNCA en el repo.
- Faro debe **aprobar su propio analizador**. Si tocas `index.html` o `analiza.html`, no bajes su score.

## Memoria del negocio (conocimiento que sobrevive entre sesiones)
Router: **`.claude/context/INDEX.md`** (léelo siempre). Técnico en `knowledge/` (va al repo); comercial en
`privado/` (en `.gitignore`, fuera del deploy, nunca a GitHub).

- **Fidelidad.** Si no salió de una consulta, un comando, un `archivo:línea` o de algo que dijo un socio
  con fecha, no existe. Un reporte sin evidencia es una hipótesis.
- **Autoridad.** Una regla de negocio dicha por Cristian o la socia se registra como dicho suyo, con
  fecha, y se usa sin medirla. Un *hecho* del sistema o del mercado dicho por ellos cuenta como una
  verificación: falta la segunda.
- **Estados, en el título de cada entrada** (lo único que sobrevive al grep):
  `[confirmado]` (2 mediciones en momentos distintos, o 1 lectura + receta re-ejecutable) ·
  `[sin-verificar]` (default; verificar antes de actuar) · `[REFUTADO]` (prohibido; ver `Refutado por:`) ·
  `[promovido]` (ver `Vive en:`) · `[caduco]` (algo que nosotros cambiamos). Lo que es comportamiento
  (tiempos, cuotas, tasa de respuesta, conversión) exige dos mediciones.
- **Formato:** `### [estado] Título que dice el hecho` + `Estado` / `Qué` / `Cómo se verificó` / `Por qué importa`.
- **Al cerrar cada tarea, dos preguntas, siempre:** (1) ¿descubrí algo que no estaba? → se escribe directo
  en el archivo de su tema; (2) ¿algo que leí resultó falso, incompleto o caduco? → **se edita esa
  entrada** (`[REFUTADO]`/`[caduco]`), no se escribe otra al lado, y se corrige también donde esté promovida.
- **Una sola verdad.** Nunca dos versiones vivas del mismo hecho.
- **Reglas, no datos.** Un lead, un score de hoy o una cotización van a la DB, al tracker o a `tools/out/`.
  Se guarda la regla que ese dato enseñó, y solo cuando se repitió.
- Un archivo se parte cuando deja de ser un tema, nunca por tamaño. Solo la sesión principal escribe
  en `knowledge/` y `privado/`; los agentes `faro-*` reportan.
