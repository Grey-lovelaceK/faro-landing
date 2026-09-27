// Faro° — captura de lead. POST { name, email, url?, score?, checks?, marketing? } → guarda en tabla `leads`
// y, si hay RESEND_API_KEY, envía el informe al lead y un aviso interno. Sin key: guarda igual, mailed=false.
import { sql, dbReady, ensureSchema } from './_db.js';
import { mailReady, sendMail, reportEmail, leadNoticeEmail, notifyTo } from './_mail.js';

const MAX_MAILS_PER_HOUR = 3; // por dirección de correo: evita usar el formulario para escribirle a terceros

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

  const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const email = String(body.email || '').trim().toLowerCase();
  const url = body.url ? String(body.url).trim().slice(0, 500) : null;
  const scoreNum = Number(body.score);
  const score = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : null;
  const marketing = body.marketing === true;
  const checks = cleanChecks(body.checks);

  if (name.length < 2) {
    return res.status(400).json({ ok: false, error: 'Falta tu nombre.' });
  }
  // Validación de correo simple y tolerante (no RFC completa, pero filtra basura).
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Correo inválido.' });
  }

  let recent = 0;
  try {
    await ensureSchema();
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM leads WHERE email = ${email} AND created_at > now() - interval '1 hour'`;
    recent = n;
    await sql`INSERT INTO leads (name, email, url, score, marketing_ok) VALUES (${name}, ${email}, ${url}, ${score}, ${marketing})`;
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'No se pudo guardar. Intenta de nuevo más tarde.' });
  }

  let mailed = false;
  if (mailReady() && recent < MAX_MAILS_PER_HOUR) {
    const report = reportEmail({ name, url, score, checks });
    const notice = leadNoticeEmail({ name, email, url, score, marketing });
    const [r1] = await Promise.all([
      sendMail({ to: email, ...report }),
      sendMail({ to: notifyTo(), replyTo: email, ...notice }),
    ]);
    mailed = !!r1.ok;
  }
  return res.status(200).json({ ok: true, mailed });
}

// Acepta solo la forma esperada y recorta todo: el contenido termina en un correo.
function cleanChecks(list) {
  if (!Array.isArray(list)) return [];
  const status = new Set(['pass', 'warn', 'fail']);
  return list.slice(0, 40).filter(c => c && status.has(c.status)).map(c => ({
    cat: String(c.cat || '').slice(0, 30),
    label: String(c.label || '').slice(0, 80),
    status: c.status,
    tip: String(c.tip || '').slice(0, 220),
  }));
}
