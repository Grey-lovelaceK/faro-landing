// Las 21 revisiones del analizador, tal como las puntúa api/analyze.js (líneas 93-125: etiqueta, grupo y peso).
// Si cambias la rúbrica allá, cámbiala acá: la portada muestra estos pesos como dato real.
// El texto «qué mira» resume el umbral que usa el código; no promete resultados.
export interface Check { label: string; weight: number; what: string }
export interface Group { id: string; name: string; checks: Check[] }

export const groups: Group[] = [
  {
    id: 'seo', name: 'SEO', checks: [
      { label: 'Título (title)', weight: 3, what: 'Entre 30 y 65 caracteres, con lo que vendes y tu marca.' },
      { label: 'Meta descripción', weight: 3, what: 'Entre 70 y 160 caracteres: el texto que sale bajo tu título en Google.' },
      { label: 'Encabezado H1', weight: 2, what: 'Un solo titular principal que diga de qué trata la página.' },
      { label: 'HTTPS', weight: 2, what: 'Sin HTTPS, el navegador marca tu sitio como «no seguro».' },
      { label: 'Etiqueta canónica', weight: 1, what: 'Le indica a Google cuál es la versión oficial de cada página.' },
      { label: 'Idioma (lang)', weight: 1, what: 'Declara que la página está en español.' },
      { label: 'Mobile (viewport)', weight: 2, what: 'Que el sitio se adapte a la pantalla del celular.' },
    ],
  },
  {
    id: 'social', name: 'Social', checks: [
      { label: 'Open Graph título', weight: 1, what: 'El título que se ve al compartir tu enlace por WhatsApp o redes.' },
      { label: 'Open Graph descripción', weight: 1, what: 'El texto que acompaña ese enlace.' },
      { label: 'Open Graph imagen', weight: 2, what: 'La imagen de vista previa: lo primero que se ve al compartir.' },
      { label: 'Twitter Card', weight: 1, what: 'La vista previa del enlace en X.' },
    ],
  },
  {
    id: 'aeo', name: 'AEO / GEO', checks: [
      { label: 'Datos estructurados (Schema)', weight: 3, what: 'Datos schema.org que le explican a Google y a la IA qué es tu negocio.' },
      { label: 'llms.txt', weight: 2, what: 'Un archivo que orienta a los modelos de IA sobre tu sitio.' },
      { label: 'Profundidad de contenido', weight: 2, what: 'Al menos 300 palabras: la IA cita páginas con contenido.' },
      { label: 'Preguntas frecuentes (FAQ)', weight: 1, what: 'Preguntas marcadas como FAQPage, que alimentan respuestas de IA.' },
    ],
  },
  {
    id: 'tec', name: 'Técnico', checks: [
      { label: 'Respuesta del servidor', weight: 2, what: 'Que la página responda sin errores.' },
      { label: 'Velocidad de respuesta', weight: 1, what: 'Que el servidor responda en menos de 1,5 segundos.' },
      { label: 'robots.txt', weight: 1, what: 'Le indica a los buscadores qué pueden rastrear.' },
      { label: 'sitemap.xml', weight: 1, what: 'La lista de tus páginas, para que Google las encuentre todas.' },
      { label: 'Favicon', weight: 1, what: 'El ícono de la pestaña del navegador.' },
      { label: 'Texto alternativo en imágenes', weight: 1, what: 'Que al menos el 80 % de las imágenes tenga descripción (alt).' },
    ],
  },
];

export const totalWeight = groups.reduce((s, g) => s + g.checks.reduce((t, c) => t + c.weight, 0), 0);
export const totalChecks = groups.reduce((s, g) => s + g.checks.length, 0);
