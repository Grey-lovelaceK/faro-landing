// Faro° — configuración de Astro. Sitio 100% estático: Astro genera HTML y solo envía el JavaScript
// que escribimos nosotros (site.js, analytics.js, vida.js, scripts inline) y el de las islas de React.
// Islas (nov-2026): componentes .tsx con client:visible / client:idle; su HTML sale completo en el build,
// así Google y la IA lo leen sin ejecutar JS. Las funciones de /api siguen en functions/, fuera de Astro.
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://faroagencia.cl',
  output: 'static',
  integrations: [react()],
  // 'preserve' mantiene las URLs exactas del sitio anterior:
  // src/pages/diseno-web.astro → /diseno-web.html (Pages lo sirve como /diseno-web)
  // src/pages/blog/index.astro → /blog/index.html (se sirve como /blog/)
  build: { format: 'preserve' },
  trailingSlash: 'ignore',
});
