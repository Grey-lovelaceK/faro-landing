# Blog de Faro° — cómo publicar un post

El sitio está hecho con **Astro**. Cada post es un archivo Markdown en esta carpeta
(`src/content/blog/<slug>.md`). La URL final es `https://faroagencia.cl/blog/<slug>`.
Los archivos que empiezan con `_` (esta guía, la plantilla, borradores) **no se publican**.

## Publicar
1. Copia `_plantilla.md` a `_borrador-<slug>.md` y escribe. El slug va en minúsculas, con guiones y sin tildes.
2. Completa el encabezado (entre los `---`): título (máx. 60), descripción (120–160), fecha, autora o autor,
   respuesta corta, resumen, 3 o más preguntas frecuentes, cierre y posts relacionados.
   El build falla si falta algo o si el título o la descripción se pasan de largo: es a propósito.
3. Portada 1200×630 en `public/blog/img/<slug>.png` (redes) y `<slug>.webp` (página). Se puede pedir a Codex en SVG
   (marca: navy #0A0D17, cobalto #3D5AFE/#5B72FF, nada de crema ni coral) y exportar con Chrome headless + Pillow.
4. Revisión: faro-copy (texto) → Clementina aprueba → faro-aeo (SEO/AEO).
5. Renombra a `<slug>.md` (sin `_`). Agrega el post a `public/llms.txt` (sección "Blog") y enlázalo desde la
   página de servicio de su tema.
6. Prueba en local: `npm run dev` y abre http://localhost:4321/blog/<slug>.
7. `git push origin main` → Cloudflare publica. El índice `/blog/`, el sitemap y los datos estructurados
   (BlogPosting, FAQ, ruta) se generan solos.
8. Pide indexación en Search Console y Bing.

## Reglas (CLAUDE.md)
- Nada inventado: precios = los publicados; datos = con fecha y fuente enlazada; sin clientes ni casos falsos.
- No se publica contenido que desprestigie un servicio que ofrecemos.
- La respuesta corta responde el título en 2–4 frases.
