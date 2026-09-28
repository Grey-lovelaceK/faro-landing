---
name: Faro°
description: Estudio chileno de web, marketing y posicionamiento SEO · AEO · GEO. Un faro de noche que hace que te encuentren en Google y en la respuesta de la IA.
colors:
  # Tema claro (default). Fuente: src/styles/faro.css :root
  accent: "#3D5AFE"
  accent-press: "#2F49E8"
  accent-tint: "#EEF1FF"
  accent-line: "#B9C4FB"
  on-accent: "#FFFFFF"
  halo: "rgba(61, 90, 254, 0.3)"
  bg: "#FFFFFF"
  bg-soft: "#F6F7FB"
  bubble: "#F1F3F8"
  ink: "#0F172A"
  ink-2: "#1E2A44"
  muted: "#56607A"
  faint: "#646B80"
  line: "#E3E7EF"
  line-strong: "#D3D9E6"
  good: "#1F8F5F"
  # Tema oscuro. Fuente: faro.css @media (prefers-color-scheme: dark) y :root[data-theme='dark']
  accent-dark: "#5B72FF"
  accent-press-dark: "#7486FF"
  accent-tint-dark: "#141A34"
  accent-line-dark: "#34418A"
  halo-dark: "rgba(91, 114, 255, 0.3)"
  bg-dark: "#0A0D17"
  bg-soft-dark: "#0E1220"
  bubble-dark: "#151A2D"
  ink-dark: "#EAEDF6"
  ink-2-dark: "#CFD5E6"
  muted-dark: "#9AA2BC"
  faint-dark: "#8089A4"
  line-dark: "#1E2540"
  line-strong-dark: "#2A3252"
  good-dark: "#4FB98A"
  # Bloque de noche (cierre): navy fijo en ambos temas. Fuente: ClosingCta.astro .night
  night-bg: "#0A0D17"
  night-ink: "#EAEDF6"
  night-muted: "#9AA2BC"
  night-line: "#28304C"
typography:
  display:
    fontFamily: "'Palanquin Dark', 'Segoe UI', system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 4.75vw, 4.56rem)"
    fontWeight: 700
    lineHeight: 0.93
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "'Palanquin Dark', 'Segoe UI', system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.6vw, 3.2rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "'Palanquin Dark', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title-card:
    fontFamily: "'Palanquin Dark', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  price:
    fontFamily: "'Palanquin Dark', 'Segoe UI', system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 3vw, 2.8rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  lead:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.02rem, 1.3vw, 1.18rem)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 500
    letterSpacing: "0.1em"
    fontFeature: "tnum"
rounded:
  tag: "8px"
  sm: "0.75rem"
  md: "0.875rem"
  lg: "1.125rem"
  night: "28px"
  pill: "999px"
spacing:
  gap-card: "16px"
  gap-plan: "20px"
  section: "7rem"
  section-mobile: "4.5rem"
  wrap: "64.6875rem"
  wrap-sec: "77.5rem"
  wrap-wide: "87.6875rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    height: "3.25rem"
    padding: "0 1.875rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-press}"
  button-ghost:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "3.25rem"
    padding: "0 1.875rem"
  button-ghost-hover:
    textColor: "{colors.accent}"
  button-sm:
    rounded: "{rounded.sm}"
    height: "2.75rem"
    padding: "0 1.375rem"
  card-service:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "1.3125rem 1.375rem 1.125rem 1.125rem"
  card-service-featured:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  icon-tile:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    size: "3.4375rem"
  plan-card:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "32px 30px 30px"
  chip:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  tag:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent}"
    rounded: "{rounded.tag}"
    padding: "7px 10px"
  ai-card:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  night-block:
    backgroundColor: "{colors.night-bg}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.night}"
    padding: "88px 32px"
---

# Design System: Faro°

> **Alcance (27-sep-2026).** Este sistema vive hoy **solo en la portada** (`src/pages/index.astro` + `src/components/home/*` + `src/styles/faro.css`). El resto del sitio sigue con los estilos anteriores y está **pendiente de migración**: `/analiza`, `/integraciones`, `/nosotros`, `/privacidad`, `404`, las páginas de servicio (`src/layouts/Service.astro`: diseño web, SEO·AEO·GEO, marketing digital, precios) y el blog (`public/blog/blog.css`). Al migrar una página, se importa `faro.css` y se usan estos tokens; no se copian valores del sistema viejo (crema, coral, `ground`/`surface` del DESIGN.md anterior: son anti-referencia).

## Overview

**Creative North Star: "El faro de noche"**

Faro° es un estudio que hace que a su cliente lo encuentren, en Google y en la respuesta de la IA. El sistema lo dice con un solo gesto de luz: sobre blanco y tinta azul noche, un único cobalto con su halo marca dónde está la respuesta. Todo lo demás es neutro, frío y calmo, para que ese punto de luz se lea sin esfuerzo. En oscuro, la página entera se vuelve la noche y el cobalto sube de brillo; en claro, la noche aparece una sola vez, en el bloque de cierre.

La densidad es de producto SaaS del rubro, no de revista: tarjetas de borde de 1px, radios medianos, títulos grotescos muy pesados y apretados, cuerpo, etiquetas y cifras en la fuente del sistema (cifras tabulares para precios). El héroe es la tarjeta de respuesta de IA escribiéndose en vivo; ninguna foto de agencia, ningún héroe partido texto/imagen.

La prueba es el producto, no el adorno: no hay testimonios, logos de clientes ni cifras de rendimiento inventadas en ningún componente. Los componentes muestran qué se hace (checks, chips de tareas), nunca porcentajes que no se pueden sostener.

**Key Characteristics:**
- Un solo acento: cobalto `accent` con halo radial difuso; sin segundo color de marca ni tonos cálidos.
- Tinta azul noche en lugar de negro; neutros fríos con ligero azul.
- Palanquin Dark 700 apretada (-0.03 a -0.04em) para todo título; sistema para cuerpo, etiquetas y datos. Sin monoespaciada.
- Planos por defecto: bordes de 1px `line`; sombra solo en las piezas protagonistas y en hover.
- Ambos temas por tokens; el bloque de noche es navy fijo en los dos.
- **Tema claro por defecto** (desde 27-sep-2026): `public/site.js` fija `data-theme="light"` antes de pintar aunque el sistema esté en oscuro; el oscuro solo se activa con el botón y se recuerda en `localStorage` (`faro-theme`). El CSS de `prefers-color-scheme` queda como respaldo solo sin JavaScript.
- Movimiento suave y escaso, siempre desactivado con `prefers-reduced-motion`.

## Colors

Paleta de noche fría: blanco o navy de fondo, tinta azul noche, grises con azul y un cobalto como única fuente de luz.

### Primary
- **Cobalto Faro** (`accent`; `accent-dark` en oscuro): el único color con intención. Botón primario, la palabra «la respuesta.» del titular, la cita FARO° en la respuesta de IA, íconos en sus cuadros tintados, checks de los planes, enlaces de acción, foco, selección de texto y el cursor de escritura.
- **Cobalto presionado** (`accent-press`): hover del botón primario. En oscuro es *más claro* que el acento (la luz sube), en claro es más oscuro.
- **Tinta de halo** (`accent-tint`): fondo de los cuadros de ícono, del servicio destacado, de las etiquetas SEO/AEO/GEO y del anillo de 4px del plan recomendado.
- **Línea de halo** (`accent-line`): borde de hover de tarjetas, borde del servicio destacado, nodos del proceso en reposo.
- **Halo** (`halo`): solo en degradados radiales difusos (detrás de la tarjeta de IA, detrás del plan recomendado, sombra del primer nodo). Nunca como relleno plano.

### Neutral
- **Blanco / Noche** (`bg`): fondo de página y de tarjetas. Las tarjetas no cambian de fondo respecto de la página: se separan por borde.
- **Niebla** (`bg-soft`): superficie secundaria puntual (caja de prueba en Equipo).
- **Burbuja** (`bubble`): burbuja de la pregunta del usuario, avatar neutro, chips de habilidades.
- **Tinta noche** (`ink`): títulos y texto principal. **Tinta 2** (`ink-2`): enlaces de navegación, chips, ítems de listas.
- **Gris párrafo** (`muted`): bajadas y cuerpo secundario.
- **Gris metadato** (`faint`): placeholders, notas legales, unidades de precio, encabezados del pie. Está calibrado para sostener 4.5:1 sobre `bg` en ambos temas; no se aclara más.
- **Línea** (`line`) y **Línea fuerte** (`line-strong`): bordes de 1px de todas las tarjetas y divisores; la fuerte para botón fantasma, bordes discontinuos y controles.
- **Verde check** (`good`): solo el ícono de check en las filas de visibilidad. No es un segundo acento.
- **Noche fija** (`night-*`): el bloque de cierre redefine localmente fondo, tinta, gris y línea para verse navy en ambos temas.

### Named Rules
**The One Light Rule.** El cobalto es la única luz de la página. Cualquier otro color con croma (verde check aparte) es un error. Nada de crema, coral, naranjo ni degradados multicolor.

**The Halo, Not Glow Rule.** El halo es un degradado radial `closest-side` con desenfoque, detrás de una pieza protagonista. No se usa como sombra de texto, ni como borde luminoso, ni en más de dos lugares por pantalla.

**The Honest Gray Rule.** Todo texto gris usa `muted` o `faint`, que sostienen 4.5:1. No se inventan grises más claros para "suavizar".

## Typography

**Display Font:** Palanquin Dark 700 (autoalojada en `public/fonts/palanquin-dark-700-latin.woff2`, OFL, `font-display: swap`, precargada en la portada), con fallback `'Segoe UI', system-ui, sans-serif`.
**Body Font:** pila del sistema (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial`).
**Label Font:** la misma del cuerpo; la clase `.num` solo activa cifras tabulares (`font-variant-numeric: tabular-nums`).

**Character:** Una grotesca extra pesada y apretada que habla fuerte y corto, sobre un cuerpo neutro que no compite. Las etiquetas y cifras van en la misma fuente del cuerpo, en su caja natural.

**Escala raíz:** en escritorio (≥1000px) `html { font-size: clamp(15px, 100vw/96, 16px) }`, así la portada mantiene proporciones entre 1280 y 1600px. Por eso los tamaños se escriben en `rem`.

### Hierarchy
- **Display** (700, `clamp(2.5rem, 4.75vw, 4.56rem)`, 0.93): solo el titular del héroe, centrado, en dos líneas en bloque; la frase clave en `accent` sin itálica.
- **Headline** (700, `clamp(2rem, 3.6vw, 3.2rem)`, 1): H2 de cada sección. El cierre de noche usa una variante mayor (`clamp(2.2rem, 4.4vw, 4rem)`, 0.98, -0.04em, máx. 16ch).
- **Title** (700, 1.5rem, 1.1): H3 de pasos, nombre de plan; personas a 1.6rem.
- **Title card** (700, 1.3–1.36rem, 1.1–1.15, -0.03/-0.04em): títulos dentro de tarjetas (servicios, filas de visibilidad).
- **Price** (700 display, `clamp(2.2rem, 3vw, 2.8rem)`, 1, tabular): el monto del plan; el signo `$` va en la fuente de cuerpo al 62% y elevado.
- **Lead** (400, `clamp(1.02rem, 1.3vw, 1.18rem)`, 1.55, `muted`, máx. 60ch): bajada bajo un H2. La del héroe es mayor (`clamp(1.08rem, 1.6vw, 1.5rem)`, 1.35, máx. 64ch).
- **Body** (400, 1rem, 1.6): cuerpo general; párrafos de tarjeta a 0.9–0.97rem con 1.4–1.55. Máximo de línea entre 30ch y 68ch según contexto.
- **Etiqueta** (600–700, 0.8–0.95rem, sin tracking, caja normal): etiqueta de la tarjeta de IA, insignia «Recomendado», etiquetas SEO/AEO/GEO (siglas) y encabezados de columna del pie. Unidades de precio y notas en 0.78–0.86rem, `faint`.

### Named Rules
**The Tight Display Rule.** Todo H1–H3 va en Palanquin Dark 700 con tracking negativo (-0.03em base, -0.035/-0.04em en tamaños grandes) y `text-wrap: balance`. Nunca en peso regular, nunca con tracking positivo.

**The No-Mono Rule.** Nada de monoespaciada ni de mayúsculas espaciadas (texto en mayúsculas con tracking amplio) en etiquetas, eyebrows ni datos: Clementina lo vetó el 27-sep-2026 porque se lee como sitio hecho por IA. Las etiquetas van en la fuente del cuerpo, caja normal, sin tracking; las siglas (SEO, AEO, GEO) son la única mayúscula.

## Layout

Tres anchos de contenedor, todos con margen lateral mínimo de 1rem (16px) por lado:
- **`wrap`** (64.6875rem ≈ 1035px): nav y héroe.
- **`wrap-wide`** (87.6875rem ≈ 1403px): la fila bento de servicios, que desborda el héroe a propósito para asomar bajo el pliegue.
- **`wrap-sec`** (77.5rem ≈ 1240px, margen 1.5rem; 1rem bajo 640px): todas las secciones.

**Ritmo vertical:** cada `.sec` lleva 7rem arriba y abajo (4.5rem bajo 640px); secciones consecutivas eliminan el padding superior para no duplicar aire. El héroe es compacto (3rem arriba) para que el primer viewport muestre titular, botones, tarjeta de IA y el inicio del bento.

**Patrones de sección:**
- **Cabecera centrada** (`sec-head.center`): Proceso, Precios. Máx. 45rem.
- **Dos columnas asimétricas** (≈0.8–0.9fr texto / 1.1–1.2fr contenido, gap 56–64px): Visibilidad (cabecera `sticky` a 112px), Equipo, FAQ. Colapsan a una columna bajo 900px.
- **Grillas de tarjetas:** bento de 4 columnas con fracciones desiguales (303/425/311/315fr, el destacado más ancho) → 2 columnas bajo 1100px → 1 bajo 600px. Planes y extras en 3 columnas (gap 20px) → 1 columna de máx. 560px bajo 1000px.

**Puntos de quiebre en uso:** 420, 520, 600, 640, 860 (se ocultan los enlaces de nav), 900, 1000, 1100px.

**En móvil:** los botones del héroe y del cierre pasan a ancho completo; la tarjeta de IA reduce avatares a 2.5rem y oculta los puntos de ventana y la mitad larga del placeholder; los pasos del proceso pasan a una línea vertical con el nodo a la izquierda.

## Elevation & Depth

Sistema híbrido, plano por defecto. Las superficies se separan con bordes de 1px y la tinta de halo; la sombra está reservada para las piezas protagonistas (tarjeta de IA, lista de visibilidad, plan recomendado) y para el hover de las tarjetas navegables. La profundidad "de faro" la dan los halos radiales, no sombras duras.

### Shadow Vocabulary
- **Sombra de tarjeta** (`--shadow-card`: claro `0 1px 2px rgba(15,23,42,.04), 0 1.125rem 2.5rem -22px rgba(15,23,42,.18)`; oscuro `0 1px 2px rgba(0,0,0,.4), 0 1.375rem 3.125rem -24px rgba(0,0,0,.7)`): ambiental, amplia y muy negativa en spread. Tarjeta de IA, lista de visibilidad, plan recomendado y hover de servicios.
- **Sombra de botón** (`--shadow-btn`: claro `0 .5rem 1.25rem -10px rgba(61,90,254,.65)`; oscuro `0 .625rem 1.625rem -10px rgba(91,114,255,.7)`): resplandor cobalto bajo el botón primario, solo ahí.
- **Anillo de recomendado** (`0 0 0 4px var(--accent-tint)` + sombra de tarjeta): marca el plan destacado.
- **Aislador de nodo** (`0 0 0 8px var(--bg)`): corta la línea del proceso alrededor de cada nodo; el primero suma `0 10px 30px -8px var(--halo)`.

### Named Rules
**The Flat-By-Default Rule.** Una tarjeta en reposo es borde de 1px sobre `bg`. Sombra solo si es la pieza protagonista de su sección o como respuesta a hover.

**The No Hard Shadow Rule.** Nada de sombras desplazadas sólidas ni de spread positivo; toda sombra es difusa y con spread negativo.

## Shapes

Radios medianos y consistentes, con un pill para lo que es "control" o "etiqueta de tarea":
- **12px** (`--radius-sm`, 0.75rem): cuadros de ícono, botón pequeño.
- **14px** (`--radius`, 0.875rem): botones, tarjetas de servicio, burbujas de la IA, caja de prueba.
- **18px** (`--radius-lg`, 1.125rem): contenedores grandes (tarjeta de IA, lista de visibilidad, planes, extras, personas).
- **28px** (22px en móvil): solo el bloque de noche.
- **8px**: etiquetas SEO/AEO/GEO.
- **Pill** (999px): chips, insignia, campo de la tarjeta de IA. **Círculo**: avatares, nodos del proceso, botón enviar, control +/− del FAQ.

Bordes siempre de 1px sólidos; los extras de precio usan borde **discontinuo** `line-strong` que pasa a sólido en hover (se leen como "complemento opcional"). Íconos: set propio de línea en caja de 24, trazo 1.8 por defecto (2–2.2 en tamaños chicos), puntas redondeadas.

## Components

### Buttons
Directos y con peso: altos, sin mayúsculas, texto 600.
- **Shape:** esquinas suavemente redondeadas (`radius`, 14px), altura 3.25rem, padding 0 1.875rem.
- **Primary:** fondo `accent`, texto `on-accent`, con sombra de botón cobalto. Una sola acción primaria por bloque.
- **Hover / Focus:** hover a `accent-press` y sube 1px (0.2s `ease-out`); `:active` vuelve a 0. Foco global: contorno 2px `accent`, offset 3px.
- **Ghost:** fondo `bg`, texto `ink`, borde `line-strong`; en hover borde y texto pasan a `accent`.
- **Small:** 2.75rem de alto, 0.9rem, radio 12px (nav, caja de prueba).
- **Night:** dentro del bloque de noche, transparente con borde `#3A4366`; hover a borde `#8B9BFF` y texto blanco. El primario ahí fuerza el cobalto oscuro (`#5B72FF`) en ambos temas.

### Chips
- **Chip de tarea** (filas de visibilidad): pill con borde `line`, texto `ink-2` 0.86rem, check verde `good` a la izquierda.
- **Chip de habilidad** (personas): pill con fondo `bubble`, sin borde.
- **Etiqueta** (SEO/AEO/GEO): radio 8px, fondo `accent-tint`, texto `accent`, 0.86rem 700, tracking 0.01em.
- **Insignia «Recomendado»**: pill `accent` montada sobre el borde superior del plan, 0.8rem 600 en caja normal.

### Cards / Containers
- **Corner Style:** 14px (servicio) o 18px (contenedores grandes).
- **Background:** `bg`; el servicio destacado usa `accent-tint` con borde `accent-line`.
- **Shadow Strategy:** ver Elevation & Depth; hover de tarjetas navegables = borde `accent-line`, sube 3px, sombra de tarjeta.
- **Border:** 1px `line`.
- **Internal Padding:** 18–22px en tarjetas chicas, 28–32px en planes y personas.
- **Cuadro de ícono:** 3.4375rem, radio 12px, fondo `accent-tint`, ícono `accent` de 30px.

### Inputs / Fields
No hay formularios en la portada. El único "campo" es el de la tarjeta de IA, que **es un enlace al analizador** con aspecto de campo: pill de 3.625rem, borde `line`, placeholder `faint`, botón circular `accent` a la derecha. Hover: borde `accent-line` + anillo de 4px `accent-tint`. Los formularios reales (analizador) están pendientes de migrar al sistema.

### Navigation
Barra fija arriba, 4.5rem, borde inferior `line`, fondo `bg` al 86% con `backdrop-filter: saturate(1.5) blur(14px)`. Marca «Faro°» en Palanquin Dark 1.82rem con el `°` en `accent`; enlaces centrados 0.93rem 500 `ink-2` que pasan a `accent` en hover; CTA primario pequeño a la derecha. Bajo 860px se ocultan los enlaces y queda marca + CTA.

### Tarjeta de respuesta de IA (firma)
El héroe del sistema y pieza intocable. Tarjeta de 18px con sombra de tarjeta sobre un halo radial que "respira" (7s). Cabecera con destello cobalto, etiqueta «Asistente de visibilidad IA» (0.95rem 600, caja normal) y tres puntos de ventana; pregunta del usuario en burbuja `bubble` con avatar neutro; respuesta con borde `line` y avatar `accent-tint`, que se escribe letra a letra (24ms, 70ms al llegar a la marca) con cursor cobalto parpadeante; la cita **FARO°** en `accent` 700. Con movimiento reducido o sin JS, la respuesta aparece completa.

### Línea del proceso (firma)
Cuatro nodos circulares de 56px numerados (cifras tabulares) sobre una línea de 1px que va de `accent` a `line`. Con JS, la línea se dibuja (1.4s) y cada nodo se enciende en orden (0.32s de escalón); el primero es sólido `accent` con halo. En móvil pasa a vertical.

### Bloque de noche (firma)
Cierre navy fijo en ambos temas, radio 28px, borde `night-line`, con un haz radial cobalto que cae desde arriba. Titular display centrado, bajada `night-muted`, tres acciones (primaria WhatsApp + dos night).

### FAQ
Acordeón nativo `<details>` con divisores de 1px; pregunta 650 1.1rem que pasa a `accent` en hover; control circular de 32px con +/− dibujado en CSS que se rellena de `accent` al abrir. Primera pregunta abierta. El mismo arreglo alimenta el JSON-LD FAQPage.

### Motion
Curva única `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`. Aparición al hacer scroll solo para lo que está bajo el pliegue (opacidad + 18px, 0.7–0.8s, escalón de 70ms por hermano); sin JS todo queda visible. Con `prefers-reduced-motion: reduce` se anulan todas las animaciones y transiciones.

## Do's and Don'ts

### Do:
- **Do** usar un solo acento, `accent`, y reservar el halo radial para la pieza protagonista de la sección.
- **Do** escribir todo color como token de `faro.css`, con valor claro y oscuro (`:root`, `prefers-color-scheme` guardado con `:not([data-theme='light'])` y `[data-theme='dark']`).
- **Do** usar Palanquin Dark 700 con tracking negativo para títulos y cifras tabulares (`.num`) para precios y datos.
- **Do** separar superficies con bordes de 1px `line`; sombra de tarjeta solo en protagonistas y hover.
- **Do** escribir tamaños en `rem` para que escalen con la raíz de escritorio.
- **Do** mantener el texto gris en `muted` o `faint` (≥4.5:1 en ambos temas).
- **Do** respetar `prefers-reduced-motion` y que todo se vea completo sin JavaScript.
- **Do** mostrar qué se hace (checks, chips de tareas, precios publicados) como prueba.

### Don't:
- **Don't** usar crema, coral, naranjo ni ningún tono cálido; ni un segundo color de marca.
- **Don't** poner eyebrows ni kickers (textos pequeños en mayúsculas sobre los H2); la sección arranca en su título.
- **Don't** inventar clientes, testimonios, logos, porcentajes ni barras de rendimiento.
- **Don't** usar un héroe partido texto/foto de agencia ni fotos de stock.
- **Don't** usar sombras duras desplazadas ni resplandores como borde o sombra de texto.
- **Don't** aclarar el gris por debajo de `faint` ni poner texto `faint` sobre fondos tintados.
- **Don't** usar íconos-glifo, emojis o sets de íconos externos; solo `Icon.astro` (línea, caja 24).
- **Don't** copiar valores del DESIGN.md anterior (`ground`, `surface`, `surface-2`); ese sistema quedó descartado.
