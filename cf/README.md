# Deploy en Cloudflare Pages

Los endpoints siguen viviendo en `api/*.js` (formato Vercel). `functions/api/*.js` los envuelve
con `cf/adapter.js`, así el mismo código corre en Vercel y en Cloudflare.

## Configuración del proyecto (dashboard → Workers & Pages → Pages → Connect to Git)
- Repo: `Grey-lovelaceK/faro-landing`
- Build command: `npm install && npm run build:cf` (`astro build` + `node cf/sitemap.mjs`)
- Build output directory: `dist`
- Variables (Settings → Variables and Secrets, tipo *Secret*): `STORAGE_DATABASE_URL`,
  `LEADS_PASSWORD`, `GEMINI_API_KEY`, opcionales `GEMINI_MODEL`, `PAGESPEED_API_KEY`.

## Notas
- El sitio lo genera Astro (`src/`, `public/`) en `dist/`; `cf/sitemap.mjs` arma `dist/sitemap.xml` desde los canonical.
- Pages sirve `/analiza` para `analiza.html` por defecto (equivale a `cleanUrls`).
- Plan Free: 10 ms de CPU por request. `analyze` parsea HTML; si una web muy pesada lo excede,
  el plan Workers Paid (~US$5/mes) sube el límite.
- Pages Functions no tiene cron. Las integraciones con sync periódico irán en un Worker aparte.
