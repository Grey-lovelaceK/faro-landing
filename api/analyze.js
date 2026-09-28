// Faro° — Analizador de web v1 (serverless, Vercel).
// Baja el HTML de la URL (server-side, sin CORS) y evalúa SEO + social + AEO/GEO + técnico.
// Sin dependencias, sin API keys. Devuelve JSON con score y checks, más extras sin puntaje
// (tech: con qué está hecha; understood: qué datos del negocio lee Google en su JSON-LD).

export default async function handler(req, res) {
  const raw = (req.query && req.query.url) || '';
  let target = String(raw).trim();
  if (!target) return res.status(400).json({ ok: false, error: 'Falta la URL.' });
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

  let url;
  try { url = new URL(target); } catch { return res.status(400).json({ ok: false, error: 'URL inválida.' }); }
  const origin = url.origin;

  const t0 = Date.now();
  let html = '', status = 0, finalUrl = target, headers = null;
  try {
    const r = await fetchWithTimeout(target, 12000);
    status = r.status;
    finalUrl = r.url || target;
    headers = r.headers;
    html = await capText(r, 900_000); // cap ~900KB
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'No pudimos acceder al sitio. ¿Existe y responde? (' + (e.name || 'error') + ')', url: target });
  }
  const ms = Date.now() - t0;
  if ([401, 403, 429, 503].includes(status) && /forbidden|access denied|captcha|cloudflare|attention required|just a moment|too many requests|acceso denegado/i.test(html.slice(0, 5000))) {
    return res.status(200).json({ ok: false, blocked: true, url: finalUrl,
      error: `El sitio bloquea las revisiones automáticas (HTTP ${status}), así que no podemos ponerle nota sin ver la página real. Ábrelo en tu navegador: si carga, el bloqueo es solo para robots.` });
  }

  // ── Extracción tolerante ────────────────────────────────────────────
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  const attr = (tag, name) => { const m = tag.match(new RegExp(name + '\\s*=\\s*["\\\']([^"\\\']*)["\\\']', 'i')); return m ? m[1] : null; };
  const metaBy = (key) => { for (const t of metaTags) { const n = (attr(t, 'name') || attr(t, 'property') || '').toLowerCase(); if (n === key) return (attr(t, 'content') || '').trim(); } return null; };

  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleM ? decode(titleM[1].trim()) : null;
  const desc = metaBy('description');
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const canonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const langM = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  const viewport = !!metaBy('viewport');
  const isHttps = url.protocol === 'https:';

  const og = { title: metaBy('og:title'), desc: metaBy('og:description'), image: metaBy('og:image') };
  const twitter = !!metaBy('twitter:card');

  // JSON-LD (AEO)
  const ldBlocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  const ldTypes = [];
  const ldNodes = [];
  for (const b of ldBlocks) {
    try {
      const json = JSON.parse(b.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, ''));
      collectTypes(json, ldTypes);
      collectNodes(json, ldNodes);
    } catch { /* json-ld malformado */ }
  }
  const hasFaq = ldTypes.some(t => /faq/i.test(t));

  // Contenido
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').length : 0;

  // Imágenes / alt
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const imgsAlt = imgs.filter(t => /alt\s*=\s*["'][^"']*[^"'\s]/i.test(t)).length;
  const altPct = imgs.length ? Math.round(imgsAlt / imgs.length * 100) : 100;

  const favicon = /<link[^>]+rel=["'][^"']*icon/i.test(html);

  // Recursos externos (paralelo)
  const [llms, robots, sitemap] = await Promise.all([
    exists(origin + '/llms.txt', true),
    exists(origin + '/robots.txt', true),
    exists(origin + '/sitemap.xml', false),
  ]);

  // ── Checks ──────────────────────────────────────────────────────────
  const C = [];
  const add = (cat, label, status, detail, tip, weight) => C.push({ cat, label, status, detail, tip, weight });

  // SEO
  add('SEO', 'Título (title)', title ? (title.length >= 30 && title.length <= 65 ? 'pass' : 'warn') : 'fail',
    title ? `"${clip(title, 70)}" (${title.length} car.)` : 'No tiene', 'Ideal 30–65 caracteres, con la keyword y la marca.', 3);
  add('SEO', 'Meta descripción', desc ? (desc.length >= 70 && desc.length <= 160 ? 'pass' : 'warn') : 'fail',
    desc ? `${desc.length} caracteres` : 'No tiene', 'Ideal 70–160 caracteres, con gancho y llamado a la acción.', 3);
  add('SEO', 'Encabezado H1', h1Count === 1 ? 'pass' : (h1Count > 1 ? 'warn' : 'fail'),
    `${h1Count} encontrados`, 'Debe haber exactamente un H1 con el tema principal.', 2);
  add('SEO', 'HTTPS', isHttps ? 'pass' : 'fail', isHttps ? 'Sí' : 'No', 'Sin HTTPS Google penaliza y el navegador marca "no seguro".', 2);
  add('SEO', 'Etiqueta canónica', canonical ? 'pass' : 'warn', canonical ? 'Sí' : 'No', 'Evita contenido duplicado; recomendable.', 1);
  add('SEO', 'Idioma (lang)', langM ? 'pass' : 'warn', langM ? langM[1] : 'No declarado', 'Declara <html lang="es"> para buscadores y accesibilidad.', 1);
  add('SEO', 'Mobile (viewport)', viewport ? 'pass' : 'fail', viewport ? 'Sí' : 'No', 'Sin viewport el sitio no se adapta a celulares.', 2);

  // Social
  add('Social', 'Open Graph título', og.title ? 'pass' : 'warn', og.title ? 'Sí' : 'No', 'Controla cómo se ve al compartir en redes/WhatsApp.', 1);
  add('Social', 'Open Graph descripción', og.desc ? 'pass' : 'warn', og.desc ? 'Sí' : 'No', 'Texto al compartir el enlace.', 1);
  add('Social', 'Open Graph imagen', og.image ? 'pass' : 'warn', og.image ? 'Sí' : 'No', 'Imagen de vista previa al compartir. Muy visible.', 2);
  add('Social', 'Twitter Card', twitter ? 'pass' : 'warn', twitter ? 'Sí' : 'No', 'Vista previa enriquecida en X/Twitter.', 1);

  // AEO / GEO
  add('AEO / GEO', 'Datos estructurados (Schema)', ldTypes.length ? 'pass' : 'fail',
    ldTypes.length ? ldTypes.slice(0, 6).join(', ') : 'No tiene', 'JSON-LD (schema.org) ayuda a Google Y a la IA a entender tu negocio.', 3);
  add('AEO / GEO', 'llms.txt', llms.found ? 'pass' : 'warn', llms.found ? 'Sí' : 'No', 'Archivo que guía a los modelos de IA sobre tu sitio. Casi nadie lo tiene = ventaja.', 2);
  add('AEO / GEO', 'Profundidad de contenido', words >= 300 ? 'pass' : (words >= 100 ? 'warn' : 'fail'),
    `${words} palabras`, 'La IA cita fuentes con contenido sustancioso. <100 palabras = casi invisible.', 2);
  add('AEO / GEO', 'Preguntas frecuentes (FAQ)', hasFaq ? 'pass' : 'warn', hasFaq ? 'Sí (FAQPage)' : 'No detectado', 'FAQ con schema alimenta respuestas de IA y rich snippets.', 1);

  // Técnico
  add('Técnico', 'Respuesta del servidor', status >= 200 && status < 400 ? 'pass' : 'fail', `HTTP ${status}`, 'Un 4xx/5xx significa que buscadores no pueden leerlo bien.', 2);
  add('Técnico', 'Velocidad de respuesta', ms < 1500 ? 'pass' : (ms < 3000 ? 'warn' : 'fail'), `${ms} ms`, 'Tiempo hasta el primer byte. Lento = peor ranking y conversión.', 1);
  add('Técnico', 'robots.txt', robots.found ? 'pass' : 'warn', robots.found ? 'Sí' : 'No', 'Guía a los buscadores sobre qué rastrear.', 1);
  add('Técnico', 'sitemap.xml', sitemap.found ? 'pass' : 'warn', sitemap.found ? 'Sí' : 'No', 'Ayuda a indexar todas tus páginas más rápido.', 1);
  add('Técnico', 'Favicon', favicon ? 'pass' : 'warn', favicon ? 'Sí' : 'No', 'Icono de la pestaña; detalle de profesionalismo.', 1);
  add('Técnico', 'Texto alternativo en imágenes', altPct >= 80 ? 'pass' : (altPct >= 50 ? 'warn' : 'fail'),
    imgs.length ? `${altPct}% con alt (${imgsAlt}/${imgs.length})` : 'Sin imágenes', 'El alt ayuda a SEO de imágenes y accesibilidad.', 1);

  // ── Score ───────────────────────────────────────────────────────────
  const totalW = C.reduce((s, c) => s + c.weight, 0);
  const gotW = C.reduce((s, c) => s + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight * 0.5 : 0), 0);
  const score = Math.round(gotW / totalW * 100);

  const cats = {};
  for (const c of C) {
    cats[c.cat] = cats[c.cat] || { w: 0, got: 0 };
    cats[c.cat].w += c.weight;
    cats[c.cat].got += (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight * 0.5 : 0);
  }
  const categories = Object.entries(cats).map(([name, v]) => ({ name, score: Math.round(v.got / v.w * 100) }));

  res.setHeader('Cache-Control', 's-maxage=600');
  return res.status(200).json({
    ok: true, url: finalUrl, score,
    grade: score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : score >= 30 ? 'D' : 'E',
    categories, checks: C,
    // Extras informativos, SIN puntaje: con qué está hecha y qué entiende Google (no cambian la nota).
    tech: detectTech(html, headers),
    understood: understood(ldNodes, ldTypes),
    richResultsUrl: 'https://search.google.com/test/rich-results?url=' + encodeURIComponent(finalUrl),
    counts: {
      pass: C.filter(c => c.status === 'pass').length,
      warn: C.filter(c => c.status === 'warn').length,
      fail: C.filter(c => c.status === 'fail').length,
    },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────
async function fetchWithTimeout(u, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(u, {
      redirect: 'follow', signal: ctrl.signal,
      // UA de navegador (como PageSpeed): muchos sitios bloquean todo lo que diga «bot» y responden 403.
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'es-CL,es;q=0.9' },
    });
  } finally { clearTimeout(id); }
}
async function capText(r, max) {
  const t = await r.text();
  return t.length > max ? t.slice(0, max) : t;
}
async function exists(u, wantText) {
  try {
    const r = await fetchWithTimeout(u, 6000);
    if (!r.ok) return { found: false };
    if (!wantText) return { found: true };
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const body = (await capText(r, 4000)).trim();
    // evita SPA 404 que devuelve 200 + HTML
    const looksHtml = ct.includes('text/html') || body.startsWith('<');
    return { found: !looksHtml && body.length > 0 };
  } catch { return { found: false }; }
}
function collectTypes(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => collectTypes(n, out)); return; }
  if (node['@type']) { const t = node['@type']; (Array.isArray(t) ? t : [t]).forEach(x => { if (!out.includes(x)) out.push(x); }); }
  if (node['@graph']) collectTypes(node['@graph'], out);
}
function collectNodes(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => collectNodes(n, out)); return; }
  if (node['@type']) out.push(node);
  if (node['@graph']) collectNodes(node['@graph'], out);
}

// Con qué está hecha la web (firmas públicas en el HTML y las cabeceras). Informativo: sirve para saber qué ofrecer.
const TECH = [
  ['WordPress', 'plataforma', h => /\/wp-content\/|\/wp-includes\//i.test(h)],
  ['WooCommerce', 'tienda', h => /\/plugins\/woocommerce\/|woocommerce-(page|cart|js)|wc-block/i.test(h)],
  ['Shopify', 'tienda', (h, H) => /cdn\.shopify\.com|Shopify\.theme/i.test(h) || !!H('x-shopify-stage')],
  ['Jumpseller', 'tienda', h => /jumpseller\.com\/|jumpseller-|Jumpseller\./i.test(h)],
  ['PrestaShop', 'tienda', h => /var prestashop|prestashop\s*=|\/modules\/ps_|content="prestashop/i.test(h)],
  ['Tiendanube', 'tienda', h => /mitiendanube|nuvemshop|tiendanube/i.test(h)],
  ['Bsale', 'tienda', h => /bsale\.(cl|io)\/|bsalestore|dojiw2m9tvv09/i.test(h)],
  ['Wix', 'plataforma', (h, H) => /static\.wixstatic\.com|wix\.com\/|_wixCssImports/i.test(h) || !!H('x-wix-request-id')],
  ['Squarespace', 'plataforma', h => /static1\.squarespace\.com|squarespace-cdn/i.test(h)],
  ['Webflow', 'plataforma', h => /data-wf-page|website-files\.com|webflow\.js/i.test(h)],
  ['Lovable', 'plataforma', h => /cdn\.gpteng\.co|gptengineer|lovable-tagger|lovable\.app\/[^"' ]*\.js/i.test(h)],
  ['Google Sites', 'plataforma', h => /sites\.google\.com|gstatic\.com\/atari/i.test(h)],
  ['Joomla', 'plataforma', h => /\/media\/jui\/|content="joomla/i.test(h)],
  ['Drupal', 'plataforma', h => /drupal-settings-json|Drupal\.settings|\/sites\/default\/files/i.test(h)],
  ['Elementor', 'constructor', h => /elementor/i.test(h)],
  ['Next.js', 'framework', h => /__NEXT_DATA__|\/_next\/static/i.test(h)],
  ['Astro', 'framework', h => /content="astro|\/_astro\//i.test(h)],
  ['Google Analytics', 'medición', h => /gtag\(|google-analytics\.com|googletagmanager\.com\/gtag/i.test(h)],
  ['Google Tag Manager', 'medición', h => /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/.test(h)],
  ['Píxel de Meta', 'medición', h => /connect\.facebook\.net\/[^"']*fbevents|fbq\(/i.test(h)],
  ['WhatsApp', 'contacto', h => /wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com/i.test(h)],
  ['Cloudflare', 'hosting', (h, H) => /cloudflare/i.test(H('server') || '')],
];
function detectTech(html, headers) {
  const H = (k) => { try { return headers ? headers.get(k) : null; } catch { return null; } };
  // Solo el código (atributos y scripts), no el texto visible: una página que *menciona* WooCommerce no está hecha en WooCommerce.
  const attrs = (html.match(/\b(?:src|href|content|class|id|data-[a-z-]+)\s*=\s*["'][^"']*["']/gi) || []).join(' ');
  const scripts = (html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || []).join(' ').replace(/<script[^>]+application\/ld\+json[\s\S]*?<\/script>/gi, ' ');
  const code = attrs + ' ' + scripts;
  const found = TECH.filter(([, , test]) => { try { return test(code, H); } catch { return false; } }).map(([name, kind]) => ({ name, kind }));
  const gen = (html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']{2,60})["']/i) || [])[1];
  if (gen && !found.some(t => gen.toLowerCase().includes(t.name.toLowerCase()))) found.unshift({ name: gen.trim(), kind: 'generador' });
  return found.slice(0, 12);
}

// Qué datos del negocio puede leer Google en el JSON-LD (lo que alimenta la ficha, los resultados enriquecidos y la IA).
function understood(nodes, types) {
  const biz = nodes.find(n => [].concat(n['@type']).some(t => /Organization|LocalBusiness|Service|Store|Restaurant|Dentist|Physician|Clinic|Salon|Agency|Shop/i.test(String(t)))) || null;
  const has = (k) => !!(biz && biz[k] && (typeof biz[k] !== 'object' || Object.keys(biz[k]).length));
  return {
    types: types.slice(0, 10),
    business: biz ? String([].concat(biz['@type'])[0]) : null,
    fields: [
      ['Nombre del negocio', has('name')],
      ['Dirección', has('address')],
      ['Teléfono', has('telephone') || has('contactPoint')],
      ['Horario de atención', has('openingHours') || has('openingHoursSpecification')],
      ['Reseñas o calificación', has('aggregateRating') || has('review')],
      ['Logo', has('logo') || has('image')],
      ['Redes sociales (sameAs)', has('sameAs')],
      ['Precios u ofertas', has('priceRange') || has('offers') || has('hasOfferCatalog') || types.some(t => /Offer|Product/i.test(t))],
      ['Preguntas frecuentes', types.some(t => /FAQ/i.test(t))],
    ].map(([label, ok]) => ({ label, ok })),
  };
}
function decode(s) { return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
function clip(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
