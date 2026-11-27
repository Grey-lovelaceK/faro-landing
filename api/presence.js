// Faro° — ¿La IA conoce tu negocio? (para quien NO tiene web).
// GET /api/presence?name=...&rubro=...&comuna=...&ig=...
// 1) Busca en la web real (Tavily) lo que buscaría un cliente («pastelería en Macul») y el nombre del negocio.
// 2) Una IA (Groq y, si falla, Gemini) lee SOLO esos resultados y responde como un asistente: a quién recomienda,
//    si el negocio aparece, qué presencia tiene y qué hacer. Sin resultados de búsqueda, no nombra competidores.
// Env: TAVILY_API_KEY + GROQ_API_KEY y/o GEMINI_API_KEY (ver api/_llm.js).

import { askJson, search } from './_llm.js';
import { placeStats } from './_places.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (!process.env.TAVILY_API_KEY || !(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY)) {
    return res.status(200).json({ ok: false, error: 'El chequeo de IA no está configurado por ahora.' });
  }
  const q = req.query || {};
  const name = field(q.name, 80);
  const rubro = field(q.rubro, 60);
  const comuna = field(q.comuna, 60);
  const ig = field(q.ig, 60).replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
  if (name.length < 2 || rubro.length < 3 || comuna.length < 3) {
    return res.status(400).json({ ok: false, error: 'Completa el nombre del negocio, el rubro y la comuna.' });
  }
  const query = `${rubro} en ${comuna}`;

  // En paralelo: la búsqueda del cliente, la del propio negocio y el dato REAL de Google (Places).
  const [market, own, place] = await Promise.all([
    search(`${rubro} en ${comuna} Chile recomendados`, { max: 8 }),
    search(`"${name}" ${comuna}`, { max: 6 }),
    placeStats(name, comuna),
  ]);
  if (!market.ok && !own.ok) {
    return res.status(200).json({ ok: false, error: market.quota ? 'La búsqueda llegó a su límite de hoy. Intenta más tarde.' : 'No pudimos buscar en la web ahora. Intenta de nuevo.' });
  }
  // Dato verificado del Perfil de Empresa (si Places lo encontró). Manda sobre lo que adivine la IA.
  const g = place.ok ? place.place : null;

  const fmt = (list) => list.map((x, i) => `[${i + 1}] ${x.title} — ${host(x.url)}\n${x.content}`).join('\n\n') || '(sin resultados)';
  const prompt = `Eres un asistente de IA que ayuda a una persona en Chile a encontrar un negocio. Solo puedes usar los resultados de búsqueda de abajo: no inventes negocios, datos ni reseñas.

BÚSQUEDA DEL CLIENTE: "${query}, Chile"
${fmt(market.results)}

BÚSQUEDA DEL NEGOCIO "${name}" (rubro: ${rubro}, comuna: ${comuna}${ig ? `, Instagram: @${ig}` : ''}):
${fmt(own.results)}

${g
  ? `DATOS REALES DE GOOGLE (verificados por API, son la VERDAD; valen por sobre lo que muestren o no las búsquedas de arriba):
- Perfil de Empresa en Google: SÍ existe${g.status && g.status !== 'OPERATIONAL' ? ` (estado: ${g.status})` : ''}.
- Reseñas en Google: ${g.userRatingCount}${g.rating ? `, nota ${g.rating}/5` : ''}.
Usa estos números tal cual en tu respuesta. Está PROHIBIDO decir que las reseñas o la información de Google Maps son "pocas", "limitadas" o "escasas" cuando el número es alto.`
  : `No tenemos un dato verificado de Google Maps ni de reseñas de este negocio. Por eso, si no aparecen en los resultados de búsqueda, NO afirmes que tiene pocas o limitadas reseñas: di solo que no aparecieron en nuestra búsqueda web, que puede no mostrarlas.`}

TAREA:
1) Responde al cliente como lo haría un asistente (answer, 2-4 frases) y lista los negocios que recomendarías (recommended: solo nombres que aparezcan en los resultados de la búsqueda del cliente; máximo 5).
2) ¿Recomendaste a "${name}"? found = "si" si está en tu recomendación; "parcial" si aparece en los resultados pero no lo recomendarías; "no" si no aparece.
3) presence, según los resultados del negocio: googleMaps, instagram, web, reviews = "si" | "no" | "no se sabe" (usa "no se sabe" si los resultados no alcanzan para afirmarlo). Si arriba hay DATOS REALES DE GOOGLE, usa esos para googleMaps y reviews, no "no se sabe".
4) verdict: 1-2 frases directas para el dueño sobre qué tan visible es hoy. Si hay datos reales de reseñas, menciónalos con el número; nunca inventes escasez de reseñas.
5) actions: 3-5 acciones concretas para que Google y la IA lo encuentren y lo recomienden. Al perfil de Google llámalo «Perfil de Empresa en Google» (no «Google My Business»).
No incluyas direcciones ni teléfonos de otros negocios. Español de Chile, tono directo y honesto.

Formato exacto: {"answer": "", "recommended": [""], "found": "si|parcial|no", "presence": {"googleMaps": "", "instagram": "", "web": "", "reviews": ""}, "verdict": "", "actions": [""]}`;

  const ai = await askJson(prompt, { order: ['groq', 'gemini'] });
  if (!ai.ok) {
    return res.status(200).json({ ok: false, error: ai.quota ? 'El chequeo de IA llegó a su límite de hoy. Intenta más tarde.' : 'El chequeo de IA no está disponible por ahora.' });
  }
  const out = ai.json;

  const sources = [];
  for (const x of [...market.results, ...own.results]) {
    if (x.title && !sources.some(s => s.url === x.url)) sources.push({ title: x.title.slice(0, 90), uri: x.url });
    if (sources.length >= 6) break;
  }
  // Solo nombres que realmente aparecen en los resultados del cliente (defensa contra nombres inventados).
  const haystack = market.results.map(x => (x.title + ' ' + x.content).toLowerCase()).join(' ');
  const recommended = arr(out.recommended).map(x => x.slice(0, 80)).filter(n => haystack.includes(n.toLowerCase().slice(0, 18))).slice(0, 5);

  // «found» sale de los datos: en la lista de recomendados → si; solo en la búsqueda del cliente → parcial; si no, no.
  const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const key = norm(name);
  const inRec = recommended.some(r => norm(r).includes(key) || key.includes(norm(r)));
  const inMarket = norm(haystack).includes(key);
  const found = inRec ? 'si' : inMarket ? 'parcial' : 'no';
  const yn = v => (['si', 'no', 'no se sabe'].includes(v) ? v : 'no se sabe');
  return res.status(200).json({
    ok: true,
    model: ai.model,
    provider: ai.provider,
    grounded: market.results.length > 0,
    business: name, rubro, comuna, instagram: ig || null,
    query,
    found,
    verdict: str(out.verdict).slice(0, 400),
    answer: str(out.answer).slice(0, 700),
    recommended,
    presence: {
      googleMaps: g ? 'si' : yn(out.presence?.googleMaps),
      instagram: yn(out.presence?.instagram),
      web: yn(out.presence?.web),
      reviews: g ? (g.userRatingCount > 0 ? 'si' : 'no') : yn(out.presence?.reviews),
    },
    // Dato real de Google (null si Places no lo encontró o no está configurado): lo usa el front para mostrar el número.
    google: g ? { reviews: g.userRatingCount, rating: g.rating, mapsUri: g.googleMapsUri } : null,
    actions: arr(out.actions).slice(0, 5).map(x => x.slice(0, 220)),
    sources,
  });
}

function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }
function field(v, n) { return String(v || '').replace(/[<>"`]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); }
function str(v) { return v == null ? '' : String(v); }
function arr(v) { return Array.isArray(v) ? v.map(str).filter(Boolean) : []; }
