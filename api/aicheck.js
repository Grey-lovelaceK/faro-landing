// Faro° — Chequeo real de IA (¿te menciona/cita la IA?) vía Google Gemini (free tier).
// GET /api/aicheck?url=...
// Baja la página, se la da a Gemini y simula si un asistente de IA (ChatGPT/Perplexity)
// recomendaría/citaría este sitio ante una consulta típica del rubro. Devuelve JSON forzado.
// Usa Gemini (GEMINI_API_KEY) y, si falla, Groq (GROQ_API_KEY) como respaldo: ver api/_llm.js.

import { askJson } from './_llm.js';

export const config = { maxDuration: 30 };

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string' },   // rubro inferido
    location: { type: 'string' },   // ubicación inferida ("no declarada" si no hay)
    query: { type: 'string' },      // consulta típica que probaría un cliente
    cited: { type: 'string', enum: ['si', 'parcial', 'no'] },
    aeoScore: { type: 'integer' },  // 0-100 qué tan citeable por IA
    verdict: { type: 'string' },    // 1-2 frases, directo
    reasons: { type: 'array', items: { type: 'string' } },
    actions: { type: 'array', items: { type: 'string' } },
  },
  required: ['category', 'location', 'query', 'cited', 'aeoScore', 'verdict', 'reasons', 'actions'],
};

export default async function handler(req, res) {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return res.status(200).json({ ok: false, error: 'Chequeo de IA no configurado.' });
  }

  const raw = (req.query && req.query.url) || '';
  let target = String(raw).trim();
  if (!target) return res.status(400).json({ ok: false, error: 'Falta la URL.' });
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
  let urlObj;
  try { urlObj = new URL(target); } catch { return res.status(400).json({ ok: false, error: 'URL inválida.' }); }

  // 1) Bajar y extraer contenido de la página
  let page;
  try {
    page = await extractPage(target);
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'No pudimos leer el sitio para el chequeo de IA.' });
  }

  // 2) Prompt para Gemini
  const prompt = buildPrompt(urlObj.hostname, page);

  // 3) IA con salida JSON: Gemini primero; si falla (cuota, caída, modelo retirado), Groq.
  const ai = await askJson(prompt, { schema: RESPONSE_SCHEMA });
  if (!ai.ok) {
    return res.status(200).json({ ok: false, error: ai.quota ? 'El chequeo de IA llegó a su límite de hoy. Intenta más tarde.' : 'El chequeo de IA no está disponible por ahora.' });
  }
  const out = ai.json;

  // Normalizar
  const clampScore = Math.max(0, Math.min(100, Math.round(Number(out.aeoScore) || 0)));
  return res.status(200).json({
    ok: true,
    url: target,
    model: ai.model,
    category: str(out.category),
    location: str(out.location),
    query: str(out.query),
    cited: ['si', 'parcial', 'no'].includes(out.cited) ? out.cited : 'no',
    aeoScore: clampScore,
    verdict: str(out.verdict),
    reasons: arr(out.reasons).slice(0, 5),
    actions: arr(out.actions).slice(0, 6),
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────
function buildPrompt(host, p) {
  return `Eres un evaluador experto en AEO/GEO (visibilidad en asistentes de IA como ChatGPT, Perplexity y Google AI Overviews).
Analiza esta página web de un negocio y responde SOLO con el JSON del esquema pedido, en español de Chile, tono directo y honesto (sin humo).

DATOS DE LA PÁGINA (${host}):
- Título: ${p.title || '(sin título)'}
- Meta descripción: ${p.desc || '(sin meta descripción)'}
- H1: ${p.h1 || '(sin H1)'}
- Schema/JSON-LD detectado: ${p.schema || 'ninguno'}
- Texto visible (recortado):
"""
${p.text || '(sin contenido de texto)'}
"""

TAREA:
1. Infiere el rubro del negocio (category) y su ubicación/ciudad (location; "no declarada" si no aparece).
2. Escribe la consulta típica (query) que un cliente real le haría a un asistente de IA para encontrar un negocio así (ej: "mejores growshops en Macul").
3. Simula: ante esa consulta, ¿este sitio tiene contenido suficiente y estructurado para que la IA lo cite o recomiende? Responde cited = "si" | "parcial" | "no".
4. aeoScore: 0-100, qué tan citeable/entendible es hoy para un LLM.
5. verdict: 1-2 frases directas sobre su visibilidad en IA.
6. reasons: 2-4 motivos concretos del veredicto.
7. actions: 3-5 acciones específicas y accionables para que la IA lo cite más (schema, FAQ, contenido, datos de contacto/NAP, etc.).

Formato exacto: {"category": "", "location": "", "query": "", "cited": "si|parcial|no", "aeoScore": 0, "verdict": "", "reasons": [""], "actions": [""]}`;
}

async function extractPage(target) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 12000);
  let html;
  try {
    const r = await fetch(target, {
      redirect: 'follow', signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'es-CL,es;q=0.9' },
    });
    const t = await r.text();
    html = t.length > 900_000 ? t.slice(0, 900_000) : t;
  } finally { clearTimeout(id); }

  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  const ldTypes = [];
  const ldBlocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of ldBlocks) {
    try {
      const json = JSON.parse(b.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, ''));
      collectTypes(json, ldTypes);
    } catch { /* malformado */ }
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title: clean(titleM ? titleM[1] : ''),
    desc: clean(metaDesc ? metaDesc[1] : ''),
    h1: clean(h1M ? h1M[1] : ''),
    schema: ldTypes.slice(0, 8).join(', '),
    text: clip(text, 3500),
  };
}

function collectTypes(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => collectTypes(n, out)); return; }
  if (node['@type']) { const t = node['@type']; (Array.isArray(t) ? t : [t]).forEach(x => { if (!out.includes(x)) out.push(x); }); }
  if (node['@graph']) collectTypes(node['@graph'], out);
}
function clean(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim(); }
function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
function str(v) { return v == null ? '' : String(v); }
function arr(v) { return Array.isArray(v) ? v.map(str).filter(Boolean) : []; }
