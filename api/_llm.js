// Faro° — llamadas a modelos de IA con respaldo: Gemini → Groq (y al revés si se pide).
// El "_" evita que se enrute como endpoint. Todas devuelven { ok, json, provider, model } o { ok:false, error, quota }.
// Env: GEMINI_API_KEY / GEMINI_MODEL, GROQ_API_KEY / GROQ_MODEL, TAVILY_API_KEY. Ninguna va en el repo.

const GEMINI_MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const GROQ_MODEL = () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const RETRY = [429, 500, 502, 503, 504];

async function post(url, headers, body, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    let r;
    for (let attempt = 0; attempt < 2; attempt++) {
      r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
      if (!RETRY.includes(r.status) || attempt === 1) break;
      await new Promise((ok) => setTimeout(ok, 1200));
    }
    const data = await r.json().catch(() => ({}));
    return { r, data };
  } finally { clearTimeout(id); }
}

const isQuota = (status, msg) => status === 402 || status === 429 || /quota|rate|exceeded|\blimit\b|credits/i.test(msg || '');

// Gemini con salida JSON. schema opcional (responseSchema).
export async function gemini(prompt, { schema, ms = 22000, temperature = 0.3 } = {}) {
  if (!process.env.GEMINI_API_KEY) return { ok: false, error: 'sin GEMINI_API_KEY' };
  try {
    const { r, data } = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL()}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {},
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', ...(schema ? { responseSchema: schema } : {}), temperature, maxOutputTokens: 4096 } },
      ms,
    );
    if (!r.ok || data.error) {
      const msg = (data.error && data.error.message) || `HTTP ${r.status}`;
      console.error('[llm] Gemini', GEMINI_MODEL(), r.status, msg);
      return { ok: false, error: msg, quota: isQuota(r.status, msg) };
    }
    const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    const json = parseJson(text);
    return json ? { ok: true, json, provider: 'gemini', model: GEMINI_MODEL() } : { ok: false, error: 'Gemini sin JSON' };
  } catch (e) {
    return { ok: false, error: 'Gemini: ' + (e.name === 'AbortError' ? 'tiempo agotado' : e.message) };
  }
}

// Groq (API compatible con OpenAI) en modo JSON.
export async function groq(prompt, { ms = 20000, temperature = 0.3 } = {}) {
  if (!process.env.GROQ_API_KEY) return { ok: false, error: 'sin GROQ_API_KEY' };
  try {
    const { r, data } = await post(
      'https://api.groq.com/openai/v1/chat/completions',
      { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      {
        model: GROQ_MODEL(), temperature, max_tokens: 2048, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: 'Respondes solo con un objeto JSON válido, en español de Chile.' }, { role: 'user', content: prompt }],
      },
      ms,
    );
    if (!r.ok || data.error) {
      const msg = (data.error && (data.error.message || data.error)) || `HTTP ${r.status}`;
      console.error('[llm] Groq', GROQ_MODEL(), r.status, msg);
      return { ok: false, error: String(msg), quota: isQuota(r.status, String(msg)) };
    }
    const json = parseJson(data?.choices?.[0]?.message?.content || '');
    return json ? { ok: true, json, provider: 'groq', model: GROQ_MODEL() } : { ok: false, error: 'Groq sin JSON' };
  } catch (e) {
    return { ok: false, error: 'Groq: ' + (e.name === 'AbortError' ? 'tiempo agotado' : e.message) };
  }
}

// Prueba en orden y devuelve el primero que responda. order: ['gemini','groq'] por defecto.
export async function askJson(prompt, { schema, order = ['gemini', 'groq'], ms } = {}) {
  const errors = [];
  let quota = false;
  for (const p of order) {
    const res = p === 'gemini' ? await gemini(prompt, { schema, ms }) : await groq(prompt, { ms });
    if (res.ok) return res;
    errors.push(`${p}: ${res.error}`);
    quota = quota || !!res.quota;
  }
  return { ok: false, error: errors.join(' | '), quota };
}

// Búsqueda web real con Tavily. Devuelve [{ title, url, content }].
export async function search(query, { max = 8, ms = 12000 } = {}) {
  if (!process.env.TAVILY_API_KEY) return { ok: false, error: 'sin TAVILY_API_KEY', results: [] };
  try {
    const auth = { Authorization: `Bearer ${process.env.TAVILY_API_KEY}` };
    const base = { query, max_results: max, search_depth: 'basic', include_answer: false };
    let { r, data } = await post('https://api.tavily.com/search', auth, { ...base, country: 'chile' }, ms);
    if (r.status === 400) ({ r, data } = await post('https://api.tavily.com/search', auth, base, ms)); // por si no acepta el país
    if (!r.ok) {
      console.error('[llm] Tavily', r.status, JSON.stringify(data).slice(0, 300));
      return { ok: false, error: `Tavily HTTP ${r.status}`, quota: isQuota(r.status, JSON.stringify(data)), results: [] };
    }
    const results = (data.results || []).map(x => ({ title: String(x.title || '').slice(0, 120), url: String(x.url || ''), content: String(x.content || '').slice(0, 500) }));
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: 'Tavily: ' + (e.name === 'AbortError' ? 'tiempo agotado' : e.message), results: [] };
  }
}

export function parseJson(text) {
  if (!text) return null;
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}
