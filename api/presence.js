// Faro° — ¿La IA conoce tu negocio? (para quien NO tiene web).
// GET /api/presence?name=...&rubro=...&comuna=...&ig=...
// Le hace a Gemini, con búsqueda de Google activada, la pregunta que haría un cliente ("buena pastelería en Macul")
// y revisa si nombra al negocio. Devuelve la respuesta, las fuentes que usó y qué hacer para aparecer.
// Con búsqueda activada la respuesta se apoya en lo que hay hoy en la web (no en la "memoria" del modelo).
// Requiere GEMINI_API_KEY (mismo modelo que /api/aicheck, configurable con GEMINI_MODEL).

export const config = { maxDuration: 30 };

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export default async function handler(req, res) {
  if (!process.env.GEMINI_API_KEY) {
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
  const prompt = buildPrompt({ name, rubro, comuna, ig, query });

  let data, r;
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    });
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 26000);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body });
        if (![429, 500, 502, 503, 504].includes(r.status) || attempt === 1) break;
        console.error('[presence] Gemini', MODEL, r.status, 'reintentando');
        await new Promise((ok) => setTimeout(ok, 1500));
      }
    } finally { clearTimeout(id); }
    data = await r.json();
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'La consulta a la IA tardó demasiado. Intenta de nuevo.' });
  }

  if (!r.ok || data.error) {
    const raw = (data.error && data.error.message) || `HTTP ${r.status}`;
    console.error('[presence] Gemini', MODEL, r.status, raw);
    let msg = 'El chequeo de IA no está disponible por ahora.';
    if (r.status === 402 || /quota|rate|exceeded|\blimit\b|credits/i.test(raw)) msg = 'El chequeo de IA llegó a su límite de hoy. Intenta más tarde.';
    return res.status(200).json({ ok: false, error: msg });
  }

  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || []).map(p => p.text || '').join('');
  const out = parseJson(text);
  if (!out) return res.status(200).json({ ok: false, error: 'La IA no devolvió un resultado claro. Intenta de nuevo.' });

  // Fuentes reales que usó la búsqueda (título + dominio). Sin fuentes, no mostramos competidores:
  // serían nombres sin respaldo y podrían ser inventados.
  const chunks = cand?.groundingMetadata?.groundingChunks || [];
  const sources = [];
  for (const c of chunks) {
    const title = str(c?.web?.title).slice(0, 90);
    if (title && !sources.some(s => s.title === title)) sources.push({ title, uri: str(c?.web?.uri) });
    if (sources.length >= 6) break;
  }
  const grounded = sources.length > 0;

  const found = ['si', 'parcial', 'no'].includes(out.found) ? out.found : 'no';
  const yn = v => (['si', 'no', 'no se sabe'].includes(v) ? v : 'no se sabe');
  return res.status(200).json({
    ok: true,
    model: MODEL,
    grounded,
    business: name, rubro, comuna, instagram: ig || null,
    query,
    found,
    verdict: str(out.verdict).slice(0, 400),
    answer: str(out.answer).slice(0, 700),
    recommended: grounded ? arr(out.recommended).slice(0, 5).map(x => str(x).slice(0, 80)) : [],
    presence: {
      googleMaps: yn(out.presence?.googleMaps),
      instagram: yn(out.presence?.instagram),
      web: yn(out.presence?.web),
      reviews: yn(out.presence?.reviews),
    },
    actions: arr(out.actions).slice(0, 5).map(x => str(x).slice(0, 220)),
    sources,
  });
}

function buildPrompt({ name, rubro, comuna, ig, query }) {
  return `Eres un asistente de IA que ayuda a una persona en Chile a encontrar un negocio. Usa la búsqueda de Google.

1) Responde, como lo harías a un cliente real, a esta pregunta: "¿Dónde encuentro un buen negocio de ${query}, Chile?". Recomienda hasta 5 negocios concretos que encuentres en la búsqueda.
2) Luego revisa si el negocio "${name}" (rubro: ${rubro}, comuna: ${comuna}${ig ? `, Instagram: @${ig}` : ''}) aparece en lo que encontraste y qué presencia tiene en internet.

Responde SOLO con un objeto JSON válido (sin texto antes ni después, sin \`\`\`), en español de Chile, tono directo y honesto:
{
  "answer": "tu respuesta al cliente, 2-4 frases, como la daría un asistente",
  "recommended": ["nombres de los negocios que recomendaste, tal como aparecen en la búsqueda"],
  "found": "si" si recomendaste a ${name} | "parcial" si aparece en la búsqueda pero no lo recomendarías | "no" si no lo encontraste,
  "presence": {
    "googleMaps": "si" | "no" | "no se sabe"  (¿tiene perfil de empresa en Google Maps?),
    "instagram": "si" | "no" | "no se sabe",
    "web": "si" | "no" | "no se sabe",
    "reviews": "si" | "no" | "no se sabe"  (¿tiene reseñas visibles en Google?)
  },
  "verdict": "1-2 frases para el dueño: qué tan visible es hoy para la IA y Google",
  "actions": ["3 a 5 acciones concretas para que la IA y Google lo encuentren y lo recomienden (perfil de Google, reseñas, web, datos consistentes, etc.)"]
}
No inventes negocios ni datos: si no encuentras algo, dilo. No incluyas direcciones ni teléfonos de otros negocios.`;
}

function parseJson(text) {
  if (!text) return null;
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}
function field(v, n) { return String(v || '').replace(/[<>"`]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); }
function str(v) { return v == null ? '' : String(v); }
function arr(v) { return Array.isArray(v) ? v.map(str).filter(Boolean) : []; }
