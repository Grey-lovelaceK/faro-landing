# Blog de Faro° — cómo publicar un post

Sitio estático: cada post es un `.html` en `blog/`. El build (`cf/build.mjs`) publica todo `blog/`
**menos los archivos que empiezan con `_`** (plantillas y borradores) y **genera `sitemap.xml` solo**
a partir del `<link rel="canonical">` de cada página (lastmod = `article:modified_time`).

## Publicar
1. Borrador: `blog/_borrador-<slug>.html` (no se publica). Copia `blog/_plantilla.html`.
2. Reemplaza todo `{{…}}`. Verifica que no quede ninguno: `grep -n "{{" blog/<archivo>`.
3. Revisión: faro-copy (texto) → la socia aprueba → faro-aeo (SEO/AEO).
4. Renombra a `blog/<slug>.html` (minúsculas, guiones, sin tildes; URL final `/blog/<slug>`).
5. **Primer post:** copia `blog/_indice.html` a `blog/index.html`. Después, agrega cada post nuevo
   arriba de la lista y en el `blogPost` del JSON-LD del índice.
6. Agrega el post a `llms.txt` (sección "Blog") y enlázalo desde la página de servicio de su cluster.
7. `git push origin main` → faro-qa verifica → el post debe sacar **A** en `/analiza`.
8. Pide indexación en Search Console y Bing (Crawler Hints avisa a Bing solo).

## Reglas (CLAUDE.md)
- Nada inventado: precios = los publicados; datos = con fecha y método; sin clientes ni casos falsos.
- La "Respuesta corta" responde el título en 2–4 frases. Las FAQ visibles = las del JSON-LD, palabra por palabra.
- Un post por semana como máximo realista. Plan de contenido: pedirlo a faro-estrategia.
