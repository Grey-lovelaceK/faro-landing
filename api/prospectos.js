// Faro° — seguimiento interno de prospectos (puerta a puerta). Misma clave que /api/leads (HTTP Basic, LEADS_PASSWORD).
// GET  /api/prospectos                 → página con la tabla, filtros, estado y notas por negocio.
// GET  /api/prospectos?format=csv      → descarga con el estado actual.
// POST /api/prospectos  (JSON)         → { action:'update', id, estado, notas }  |  { action:'import', rows:[…] }
// El import sube el CSV que arma tools/combinar_prospectos.py; si el negocio ya existe, actualiza sus datos
// pero NUNCA pisa el estado ni las notas que ya escribió el equipo.
import { sql, dbReady } from './_db.js';

const ESTADOS = ['pendiente', 'contactado', 'visitado', 'interesado', 'cliente', 'descartado'];
const CAMPOS = ['nombre', 'rubro', 'comuna', 'nivel', 'publico', 'situacion', 'argumento', 'direccion', 'telefono', 'rating', 'resenas', 'score_faro', 'tel', 'whatsapp', 'instagram', 'facebook', 'web', 'maps'];

let ready = false;
async function ensure() {
  if (ready) return;
  await sql`CREATE TABLE IF NOT EXISTS prospectos (
    id TEXT PRIMARY KEY, orden INTEGER, opp REAL, nombre TEXT, rubro TEXT, comuna TEXT, nivel TEXT, publico TEXT,
    situacion TEXT, argumento TEXT, direccion TEXT, telefono TEXT, rating TEXT, resenas TEXT, score_faro TEXT,
    tel TEXT, whatsapp TEXT, instagram TEXT, facebook TEXT, web TEXT, maps TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente', notas TEXT NOT NULL DEFAULT '',
    creado TIMESTAMPTZ NOT NULL DEFAULT now(), actualizado TIMESTAMPTZ NOT NULL DEFAULT now())`;
  ready = true;
}

export default async function handler(req, res) {
  const pass = process.env.LEADS_PASSWORD || '';
  if (!pass) return res.status(500).send('Falta configurar LEADS_PASSWORD.');
  if (!sameSecret(basicPassword(req), pass)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Faro interno", charset="UTF-8"');
    return res.status(401).send('No autorizado.');
  }
  if (!dbReady) return res.status(500).send('Base de datos no configurada.');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try { await ensure(); } catch { return res.status(500).send('Error preparando la base de datos.'); }

  if (req.method === 'POST') {
    // Solo JSON: un formulario de otro sitio no puede mandar application/json sin preflight (defensa CSRF).
    const ct = String((req.headers && (req.headers['content-type'] || req.headers['Content-Type'])) || '');
    if (!ct.includes('application/json')) return res.status(415).json({ ok: false, error: 'Se espera JSON.' });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    try {
      if (body.action === 'update') {
        const id = String(body.id || '').slice(0, 200);
        const estado = ESTADOS.includes(body.estado) ? body.estado : null;
        const notas = String(body.notas ?? '').slice(0, 4000);
        if (!id || !estado) return res.status(400).json({ ok: false, error: 'Faltan datos.' });
        await sql`UPDATE prospectos SET estado = ${estado}, notas = ${notas}, actualizado = now() WHERE id = ${id}`;
        return res.status(200).json({ ok: true });
      }
      if (body.action === 'import') {
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 3000) : [];
        let n = 0;
        for (const r of rows) {
          const id = String(r.place_id || r.id || '').slice(0, 200);
          if (!id || !r.nombre) continue;
          const v = Object.fromEntries(CAMPOS.map(k => [k, String(r[k] ?? '').slice(0, k === 'argumento' ? 600 : 400)]));
          const orden = parseInt(r.orden, 10) || null, opp = parseFloat(r.opp) || null;
          await sql`INSERT INTO prospectos (id, orden, opp, nombre, rubro, comuna, nivel, publico, situacion, argumento, direccion, telefono,
              rating, resenas, score_faro, tel, whatsapp, instagram, facebook, web, maps)
            VALUES (${id}, ${orden}, ${opp}, ${v.nombre}, ${v.rubro}, ${v.comuna}, ${v.nivel}, ${v.publico}, ${v.situacion}, ${v.argumento},
              ${v.direccion}, ${v.telefono}, ${v.rating}, ${v.resenas}, ${v.score_faro}, ${v.tel}, ${v.whatsapp}, ${v.instagram}, ${v.facebook}, ${v.web}, ${v.maps})
            ON CONFLICT (id) DO UPDATE SET orden = EXCLUDED.orden, opp = EXCLUDED.opp, nombre = EXCLUDED.nombre, rubro = EXCLUDED.rubro,
              comuna = EXCLUDED.comuna, nivel = EXCLUDED.nivel, publico = EXCLUDED.publico, situacion = EXCLUDED.situacion,
              argumento = EXCLUDED.argumento, direccion = EXCLUDED.direccion, telefono = EXCLUDED.telefono, rating = EXCLUDED.rating,
              resenas = EXCLUDED.resenas, score_faro = EXCLUDED.score_faro, tel = EXCLUDED.tel, whatsapp = EXCLUDED.whatsapp,
              instagram = EXCLUDED.instagram, facebook = EXCLUDED.facebook, web = EXCLUDED.web, maps = EXCLUDED.maps`;
          n++;
        }
        return res.status(200).json({ ok: true, importados: n });
      }
      return res.status(400).json({ ok: false, error: 'Acción desconocida.' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'Error guardando en la base de datos.' });
    }
  }

  let rows;
  try { rows = await sql`SELECT * FROM prospectos ORDER BY (estado = 'descartado'), orden NULLS LAST LIMIT 5000`; }
  catch { return res.status(500).send('Error leyendo la base de datos.'); }

  if ((req.query && req.query.format) === 'csv') {
    const cols = ['orden', 'nivel', 'estado', 'notas', 'nombre', 'rubro', 'comuna', 'publico', 'situacion', 'argumento', 'direccion', 'telefono', 'rating', 'resenas', 'score_faro', 'whatsapp', 'instagram', 'facebook', 'web', 'maps', 'actualizado'];
    const cell = (x) => { const s = x == null ? '' : (x instanceof Date ? x.toISOString() : String(x)); return '"' + s.replace(/"/g, '""') + '"'; };
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="faro-prospectos.csv"');
    return res.status(200).send('﻿' + cols.join(';') + '\n' + rows.map(r => cols.map(c => cell(r[c])).join(';')).join('\n'));
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(page(rows));
}

function page(rows) {
  const data = JSON.stringify(rows.map(r => ({ ...r, creado: undefined, actualizado: r.actualizado }))).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Prospectos · Faro°</title>
<style>
  :root{--bg:#fff;--soft:#f6f7fb;--ink:#0f172a;--muted:#56607a;--faint:#646b80;--line:#e3e7ef;--accent:#3d5afe;--tint:#eef1ff;--ok:#1f8f5f;--warn:#b8690a;--no:#d63a3a}
  @media (prefers-color-scheme:dark){:root{--bg:#0a0d17;--soft:#0e1220;--ink:#eaedf6;--muted:#9aa2bc;--faint:#8089a4;--line:#1e2540;--accent:#5b72ff;--tint:#141a34;--ok:#4fb98a;--warn:#e0a24a;--no:#f0716a}}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}
  header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 18px}
  h1{margin:0;font-size:1.2rem;letter-spacing:-.02em} .sum{color:var(--muted);font-size:.86rem;margin-top:2px}
  .bar{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}
  input,select,textarea,button{font:inherit;color:inherit} input[type=search],select{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:7px 10px}
  input[type=search]{min-width:220px;flex:1} .btn{border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:10px;padding:7px 12px;cursor:pointer;text-decoration:none}
  .btn.p{background:var(--accent);border-color:var(--accent);color:#fff}
  main{padding:14px 18px 60px} .card{display:grid;grid-template-columns:44px minmax(0,1.3fr) minmax(0,1.7fr) 220px;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}
  @media (max-width:900px){.card{grid-template-columns:36px 1fr}.card .sit,.card .st{grid-column:2}}
  .o{color:var(--faint);text-align:center;font-size:.8rem} .o b{display:block;color:var(--accent);font-size:1.05rem}
  .nm{font-weight:700} .m{color:var(--muted);font-size:.84rem} .lk{margin-top:6px;display:flex;flex-wrap:wrap;gap:6px}
  .lk a{font-size:.8rem;font-weight:600;text-decoration:none;color:var(--accent);background:var(--tint);padding:3px 8px;border-radius:8px}
  .pub{display:inline-block;font-size:.72rem;font-weight:700;padding:1px 7px;border-radius:6px;background:var(--tint);color:var(--accent)}
  .sit b{display:block;margin:3px 0 2px} .sit p{margin:0;color:var(--muted);font-size:.86rem}
  .st select{width:100%} .st textarea{width:100%;min-height:52px;margin-top:6px;background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:6px 8px;resize:vertical}
  .saved{font-size:.74rem;color:var(--ok);height:1em} .e-pendiente{} .e-contactado select{border-color:var(--accent)} .e-visitado select{border-color:var(--warn)}
  .e-interesado select,.e-cliente select{border-color:var(--ok)} .e-descartado{opacity:.5}
  .empty{padding:40px 0;color:var(--muted);text-align:center}
</style></head><body>
<header>
  <h1>Prospectos · Faro°</h1><div class="sum" id="sum"></div>
  <div class="bar">
    <input type="search" id="q" placeholder="Buscar negocio, dirección, rubro…">
    <select id="fN"><option value="">Nivel: todos</option><option>A</option><option>B</option><option>C</option></select>
    <select id="fR"><option value="">Rubro: todos</option></select>
    <select id="fP"><option value="">Público: todos</option><option value="1">1 · web débil</option><option value="2">2 · web mejorable</option><option value="3">3 · sin web propia</option></select>
    <select id="fE"><option value="">Estado: todos</option>${ESTADOS.map(e => `<option>${e}</option>`).join('')}</select>
    <a class="btn" href="?format=csv">Descargar CSV</a>
    <a class="btn" href="/api/leads">Ver leads</a>
    <label class="btn p">Importar lista<input type="file" id="imp" accept=".csv" hidden></label>
  </div>
</header>
<main id="list"></main>
<script>
const DATA = ${data};
const ESTADOS = ${JSON.stringify(ESTADOS)};
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $ = id => document.getElementById(id);
[...new Set(DATA.map(r => r.rubro).filter(Boolean))].sort().forEach(r => $('fR').insertAdjacentHTML('beforeend', '<option>' + esc(r) + '</option>'));
function links(r) {
  const L = [['Llamar', r.tel && 'tel:' + r.tel], ['WhatsApp', r.whatsapp], ['Instagram', r.instagram], ['Facebook', r.facebook], ['Web', r.web], ['Maps', r.maps]];
  return L.filter(x => x[1]).map(([t, u]) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + t + '</a>').join('');
}
function render() {
  const q = $('q').value.trim().toLowerCase(), n = $('fN').value, ru = $('fR').value, p = $('fP').value, e = $('fE').value;
  const rows = DATA.filter(r => (!n || r.nivel === n) && (!ru || r.rubro === ru) && (!p || String(r.publico || '').includes(p)) && (!e || r.estado === e)
    && (!q || [r.nombre, r.direccion, r.rubro, r.situacion, r.notas].join(' ').toLowerCase().includes(q)));
  const c = {}; DATA.forEach(r => c[r.estado] = (c[r.estado] || 0) + 1);
  $('sum').textContent = DATA.length + ' prospectos · ' + ESTADOS.map(s => s + ' ' + (c[s] || 0)).join(' · ') + ' · mostrando ' + rows.length;
  $('list').innerHTML = rows.length ? rows.map(r => '<div class="card e-' + esc(r.estado) + '" data-id="' + esc(r.id) + '">' +
    '<div class="o">' + esc(r.orden || '') + '<b>' + esc(r.nivel || '') + '</b></div>' +
    '<div><div class="nm">' + esc(r.nombre) + '</div><div class="m">' + esc(r.rubro) + ' · ' + esc(String(r.direccion || '').replace(', Región Metropolitana, Chile', '')) + '</div>' +
    '<div class="m">' + (esc(r.telefono) || 'sin teléfono') + ' · ' + (r.rating ? '★ ' + esc(r.rating) + ' (' + esc(r.resenas) + ')' : 'sin reseñas') + '</div><div class="lk">' + links(r) + '</div></div>' +
    '<div class="sit"><span class="pub">Público ' + esc(r.publico) + '</span><b>' + esc(r.situacion) + '</b><p>' + esc(r.argumento) + '</p></div>' +
    '<div class="st"><select>' + ESTADOS.map(s => '<option' + (s === r.estado ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' +
    '<textarea placeholder="Notas: con quién hablaste, qué dijo, cuándo volver…">' + esc(r.notas) + '</textarea><div class="saved"></div></div></div>').join('')
    : '<div class="empty">' + (DATA.length ? 'Nada coincide con los filtros.' : 'Todavía no hay prospectos. Usa «Importar lista» con el archivo prospectos-…-TODOS.csv.') + '</div>';
}
async function save(card) {
  const id = card.dataset.id, r = DATA.find(x => x.id === id);
  r.estado = card.querySelector('select').value; r.notas = card.querySelector('textarea').value;
  card.className = 'card e-' + r.estado;
  const s = card.querySelector('.saved'); s.textContent = 'Guardando…';
  try {
    const x = await fetch(location.pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id, estado: r.estado, notas: r.notas }) });
    const j = await x.json(); s.textContent = j.ok ? 'Guardado ✓' : ('Error: ' + (j.error || '')); s.style.color = j.ok ? '' : 'var(--no)';
  } catch { s.textContent = 'Sin conexión: no se guardó'; s.style.color = 'var(--no)'; }
  setTimeout(() => { if (s.textContent === 'Guardado ✓') s.textContent = ''; }, 2500);
}
$('list').addEventListener('change', ev => { const c = ev.target.closest('.card'); if (c) save(c); });
['q', 'fN', 'fR', 'fP', 'fE'].forEach(id => $(id).addEventListener('input', render));
function parseCSV(t) {
  t = t.replace(/^\\uFEFF/, ''); const out = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ';') { row.push(cur); cur = ''; }
    else if (ch === '\\n' || ch === '\\r') { if (ch === '\\r' && t[i + 1] === '\\n') i++; row.push(cur); cur = ''; if (row.some(Boolean)) out.push(row); row = []; }
    else cur += ch; }
  if (cur || row.length) { row.push(cur); out.push(row); }
  const h = out.shift() || []; return out.map(r => Object.fromEntries(h.map((k, i) => [k, r[i] || ''])));
}
$('imp').addEventListener('change', async ev => {
  const f = ev.target.files[0]; if (!f) return;
  const rows = parseCSV(await f.text());
  if (!rows.length || !('place_id' in rows[0])) { alert('Ese archivo no tiene el formato de prospectos-…-TODOS.csv.'); return; }
  $('sum').textContent = 'Importando ' + rows.length + ' prospectos…';
  const x = await fetch(location.pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'import', rows }) });
  const j = await x.json(); if (j.ok) location.reload(); else $('sum').textContent = 'Error: ' + (j.error || 'no se pudo importar');
});
render();
</script></body></html>`;
}

function basicPassword(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = /^Basic\s+(.+)$/i.exec(h);
  if (!m) return '';
  try {
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(m[1]), c => c.charCodeAt(0)));
    return decoded.slice(decoded.indexOf(':') + 1);
  } catch { return ''; }
}
// Comparación en tiempo constante (no revela cuántos caracteres coinciden).
function sameSecret(a, b) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
