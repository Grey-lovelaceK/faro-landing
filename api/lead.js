// Faro° — captura de leads. POST { email, url?, score? } → guarda en tabla `leads`.
// Sin API keys; usa la conexión Neon de env vars (ver _db.js).
import { sql, dbReady, ensureSchema } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }
  if (!dbReady) return res.status(500).json({ ok: false, error: 'Base de datos no configurada.' });

  // Vercel parsea JSON automáticamente, pero por si llega como string:
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const email = String(body.email || '').trim().toLowerCase();
  const url = body.url ? String(body.url).trim().slice(0, 500) : null;
  const scoreNum = Number(body.score);
  const score = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : null;

  // Validación de correo simple y tolerante (no RFC completa, pero filtra basura).
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Correo inválido.' });
  }

  try {
    await ensureSchema();
    await sql`INSERT INTO leads (email, url, score) VALUES (${email}, ${url}, ${score})`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'No se pudo guardar. Intenta de nuevo más tarde.' });
  }
}
