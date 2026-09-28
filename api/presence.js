// Faro° — ¿La IA conoce tu negocio? (para quien NO tiene web).
// GET /api/presence?name=...&rubro=...&comuna=...&ig=...
// 1) Busca en la web real (Tavily) lo que buscaría un cliente («pastelería en Macul») y el nombre del negocio.
// 2) Una IA (Groq y, si falla, Gemini) lee SOLO esos resultados y responde como un asistente: a quién recomienda,
//    si el negocio aparece, qué presencia tiene y qué hacer. Sin resultados de búsqueda, no nombra competidores.
// Env: TAVILY_API_KEY + GROQ_API_KEY y/o GEMINI_API_KEY (ver api/_llm.js).

import { askJson, search, groqModels, groqModel } from './_llm.js';

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

  // Dos búsquedas en paralelo: la del cliente y la del propio negocio.
  const [market, own] = await Promise.all([
    search(`${rubro} en ${comuna} Chile recomendados`, { max: 8 }),
    search(`"${name}" ${comuna}`, { max: 6 }),
  ]);
  if (!market.ok && !own.ok) {
    return res.status(200).json({ ok: false, error: market.quota ? 'La búsqueda llegó a su límite de hoy. Intenta más tarde.' : 'No pudimos buscar en la web ahora. Intenta de nuevo.' });
  }

  const fmt = (list) => list.map((x, i) => `[${i + 1}] ${x.title} — ${host(x.url)}\n${x.content}`).join('\n\n') || '(sin resultados)';
  const prompt = `Eres un asistente de IA que ayuda a una persona en Chile a encontrar un negocio. Solo puedes usar los resultados de búsqueda de abajo: no inventes negocios, datos ni reseñas.

BÚSQUEDA DEL CLIENTE: "${query}, Chile"
${fmt(market.results)}

BÚSQUEDA DEL NEGOCIO "${name}" (rubro: ${rubro}, comuna: ${comuna}${ig ? `, Instagram: @${ig}` : ''}):
${fmt(own.results)}

TAREA:
1) Responde al cliente como lo haría un asistente (answer, 2-4 frases) y lista los negocios que recomendarías (recommended: solo nombres que aparezcan en los resultados de la búsqueda del cliente; máximo 5).
2) ¿Recomendaste a "${name}"? found = "si" si está en tu recomendación; "parcial" si aparece en los resultados pero no lo recomendarías; "no" si no aparece.
3) presence, según los resultados del negocio: googleMaps, instagram, web, reviews = "si" | "no" | "no se sabe" (usa "no se sabe" si los resultados no alcanzan para afirmarlo).
4) verdict: 1-2 frases directas para el dueño sobre qué tan visible es hoy.
5) actions: 3-5 acciones concretas para que Google y la IA lo encuentren y lo recomienden.
No incluyas direcciones ni teléfonos de otros negocios. Español de Chile, tono directo y honesto.

Formato exacto: {"answer": "", "recommended": [""], "found": "si|parcial|no", "presence": {"googleMaps": "", "instagram": "", "web": "", "reviews": ""}, "verdict": "", "actions": [""]}`;

  const ai = await askJson(prompt, { order: ['groq', 'gemini'] });
  if (!ai.ok && q.diag === 'faro-7c1') {
    return res.status(200).json({ ok: false, diag: ai.error, envs: { groq: !!process.env.GROQ_API_KEY, gemini: !!process.env.GEMINI_API_KEY, tavily: !!process.env.TAVILY_API_KEY, groqModel: await groqModel(), groqModels: await groqModels() }, search: [market.results.length, own.results.length] });
  }
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

  const found = ['si', 'parcial', 'no'].includes(out.found) ? out.found : 'no';
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
      googleMaps: yn(out.presence?.googleMaps),
      instagram: yn(out.presence?.instagram),
      web: yn(out.presence?.web),
      reviews: yn(out.presence?.reviews),
    },
    actions: arr(out.actions).slice(0, 5).map(x => x.slice(0, 220)),
    sources,
  });
}

function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }
function field(v, n) { return String(v || '').replace(/[<>"`]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); }
function str(v) { return v == null ? '' : String(v); }
function arr(v) { return Array.isArray(v) ? v.map(str).filter(Boolean) : []; }
