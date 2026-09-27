// Helpers de SEO compartidos: todo el JSON-LD sale de los mismos datos que se muestran en la página.
export const SITE = 'https://faroagencia.cl';
export const ORG_ID = `${SITE}/#org`;
export const WA = (msg: string) => `https://wa.me/56986639327?text=${encodeURIComponent(msg)}`;

const plain = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: plain(f.q), acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } })),
  };
}

export function breadcrumbJsonLd(trail: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: t.url })),
  };
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaLarga = (iso: string) => { const [y, m, d] = iso.split('-'); return `${+d} de ${MESES[+m - 1]} de ${y}`; };
const CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export const fechaCorta = (iso: string) => { const [y, m, d] = iso.split('-'); return `${+d} ${CORTOS[+m - 1]} ${y}`; };

export const wordCount = (text: string) => plain(text).split(' ').filter(Boolean).length;
