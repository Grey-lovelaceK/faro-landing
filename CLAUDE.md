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
- **Contacto:** greyc9404@gmail.com
- **Etapa:** recién empezando, SIN portafolio/testimonios todavía. Estrategia comercial: puerta a puerta
  en Macul + auditoría gratis como gancho. **NO poner en la web mensajes de "recién empezando"** (resta
  confianza) ni clientes/testimonios inventados. Honestidad total: solo datos reales y verificables.
- Dominio: aún sin dominio propio (faro.cl está tomado/parkeado). Vive en Vercel.

## Stack e infraestructura
- **Sitio estático** (HTML/CSS/JS vanilla, SIN framework). No React, no build step.
- **Hosting:** Vercel. Repo GitHub: `Grey-lovelaceK/faro-landing`. **Deploy = `git push origin main`** (auto).
- **URL prod:** https://faro-landing-alpha.vercel.app
- **Backend:** funciones serverless de Vercel en `/api/*.js` (Node, `export default handler(req,res)`,
  `fetch` global disponible). NO se usa Render ni servidor aparte.
- `vercel.json` → `cleanUrls: true` (así `/analiza` sirve `analiza.html`).

## Mapa de archivos
- `index.html` — landing (hero con "respuesta de IA" animada, servicios, visibilidad IA, proceso, equipo,
  precios, CTA). **OJO:** se edita a mano acá directo (ya no hay archivo fuente externo).
- `analiza.html` — página `/analiza`: analizador de web (form + resultados).
- `api/analyze.js` — función serverless: baja el HTML de una URL y evalúa SEO/social/AEO-GEO/técnico (score 0-100).
- `vercel.json`, `README.md`.

## Convenciones de diseño (mantener consistencia)
- **Concepto:** faro de noche → fondo navy + acento cobalto (haz de luz). NADA de cream+coral (eso es "color Claude", evitar).
- **Paleta — claro (default):** accent `#3D5AFE`, accent-2 `#5B72FF`, accent-soft `#E4E8FF`,
  ground `#EEF1F7`, surface `#FFFFFF`, surface-2 `#E6EAF2`, border `#D5DBE8`, ink `#111420`, muted `#59617A`, faint `#98A0B4`.
- **Paleta — oscuro:** accent `#5B72FF`, ground `#0A0D17`, surface `#131829`, border `#28304C`, ink `#EAEDF6`, muted `#9AA2BC`, faint `#5A6484`.
- **Semántico:** pass verde, warn ámbar, fail rojo (aparte del acento).
- **Tipografía:** títulos = system grotesk pesado y apretado (letter-spacing negativo); cuerpo = system-ui;
  utilitaria/datos/eyebrows = **monoespaciada** (fija el tono técnico).
- **Ambos temas** vía tokens CSS (`:root`, `@media (prefers-color-scheme:dark)`, `[data-theme]`). Respetar `prefers-reduced-motion`.
- Idioma: español de Chile, tono confiado y directo. Copy honesto, específico, sin humo.

## Analizador — estado y roadmap
**v1 (LISTO, en prod):** `/api/analyze` baja HTML y chequea 20 puntos: SEO (title, meta, H1, HTTPS,
canonical, lang, viewport), Social (OG, Twitter), AEO/GEO (JSON-LD/Schema, llms.txt, profundidad, FAQ),
Técnico (status, velocidad, robots, sitemap, favicon, alt). Devuelve score + nota + tips. Sin deps ni keys.

**v2 (POR HACER, en este orden):**
1. **Captura de leads** ⭐ (prioridad — trae clientes). DB serverless (Vercel Postgres/Neon, free).
   Tabla `leads` (email, url, score, created_at). `/api/lead` guarda. En `/analiza`: mostrar resultado
   (valor primero) + bloque "te enviamos el informe — déjanos tu correo" que guarda el lead. Vista `/leads`
   protegida con clave para ver/exportar. **Requiere:** crear la DB en Vercel dashboard → Storage → Postgres → Connect al proyecto (inyecta env vars solo).
2. **PageSpeed real** (Core Web Vitals): llamar API de Google PageSpeed Insights (gratis, 1 key). Ya renderiza
   con Chrome → cubre SPAs sin montar headless propio.
3. **Chequeo real de IA** (¿te cita ChatGPT?): llamar a un LLM (Anthropic/OpenAI) — cuesta centavos, requiere key.
4. **Headless propio** (solo si PSI no basta): `@sparticuz/chromium` en Vercel, o mini-back en Render. Último recurso.

## Reglas
- Cambios aditivos, sin romper lo que funciona. Copy 100% honesto (nada de clientes/números falsos).
- Verificar en prod tras cada push (`faro-landing-alpha.vercel.app`).
- Secrets (API keys, DB) → variables de entorno en Vercel, NUNCA en el repo.
