// Faro° — vista protegida de leads. GET /api/leads?key=CLAVE  → tabla HTML
//                                    GET /api/leads?key=CLAVE&format=csv → descarga CSV
// La clave vive en env var LEADS_PASSWORD (Vercel). Sin clave o incorrecta → 401.
import { sql, dbReady, ensureSchema } from './_db.js';

export default async function handler(req, res) {
  const pass = process.env.LEADS_PASSWORD || '';
  const key = (req.query && req.query.key) || '';

  if (!pass) return res.status(500).send('Falta configurar LEADS_PASSWORD.');
  if (key !== pass) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('No autorizado.');
  }
  if (!dbReady) return res.status(500).send('Base de datos no configurada.');

  let rows;
  try {
    await ensureSchema();
    rows = await sql`SELECT email, url, score, created_at FROM leads ORDER BY created_at DESC LIMIT 2000`;
  } catch (e) {
    return res.status(500).send('Error leyendo la base de datos.');
  }

  // CSV
  if ((req.query.format || '') === 'csv') {
    const cell = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = 'email,url,score,created_at\n' +
      rows.map(r => [r.email, r.url, r.score, toISO(r.created_at)].map(cell).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="faro-leads.csv"');
    return res.status(200).send(csv);
  }

  // HTML
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const trs = rows.map(r => `<tr>
      <td>${esc(r.email)}</td>
      <td class="u">${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(clip(r.url, 48))}</a>` : '—'}</td>
      <td class="s">${r.score == null ? '—' : esc(r.score)}</td>
      <td class="d">${esc(fmt(r.created_at))}</td>
    </tr>`).join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(`<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Leads — Faro°</title>
<style>
  :root{--accent:#3D5AFE;--ground:#EEF1F7;--surface:#FFFFFF;--border:#D5DBE8;--ink:#111420;--muted:#59617A;--mono:ui-monospace,"Cascadia Code",Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
  @media (prefers-color-scheme:dark){:root{--accent:#5B72FF;--ground:#0A0D17;--surface:#131829;--border:#28304C;--ink:#EAEDF6;--muted:#9AA2BC}}
  *{box-sizing:border-box}body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--sans);padding:24px 18px 60px}
  .wrap{max-width:900px;margin:0 auto}
  h1{font-size:1.4rem;letter-spacing:-.02em;margin:0 0 4px}
  .meta{font-family:var(--mono);font-size:.8rem;color:var(--muted);margin-bottom:18px}
  .meta a{color:var(--accent)}
  table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border);font-size:.88rem;vertical-align:top}
  th{font-family:var(--mono);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  tr:last-child td{border-bottom:none}
  td.u,td.d,td.s{font-family:var(--mono);font-size:.8rem;color:var(--muted)}
  td.u a{color:var(--accent)}
  .empty{padding:30px;text-align:center;color:var(--muted);font-family:var(--mono)}
</style></head><body><div class="wrap">
  <h1>Leads capturados</h1>
  <div class="meta">${rows.length} registros · <a href="/api/leads?key=${encodeURIComponent(key)}&format=csv">descargar CSV ↓</a></div>
  ${rows.length ? `<table>
    <thead><tr><th>Correo</th><th>URL analizada</th><th>Score</th><th>Fecha</th></tr></thead>
    <tbody>${trs}</tbody>
  </table>` : '<div class="empty">Todavía no hay leads.</div>'}
</div></body></html>`);
}

function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; }
function toISO(d) { try { return new Date(d).toISOString(); } catch { return String(d); } }
function fmt(d) {
  try {
    return new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return String(d); }
}
