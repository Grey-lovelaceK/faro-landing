// Faro° — configuración de Astro. Sitio 100% estático: Astro genera HTML y no envía JavaScript
// salvo el que escribimos nosotros (site.js, analytics.js y los scripts inline de cada página).
// Las funciones de /api siguen en functions/ (Cloudflare Pages Functions), fuera de Astro.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://faroagencia.cl',
  output: 'static',
  // 'preserve' mantiene las URLs exactas del sitio anterior:
  // src/pages/diseno-web.astro → /diseno-web.html (Pages lo sirve como /diseno-web)
  // src/pages/blog/index.astro → /blog/index.html (se sirve como /blog/)
  build: { format: 'preserve' },
  trailingSlash: 'ignore',
});
