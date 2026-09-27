// Faro° — envío de correo vía Resend (https://resend.com). Helper: el "_" evita que se exponga como endpoint.
// Requiere env RESEND_API_KEY. Opcionales: MAIL_FROM (default "Faro° <informes@faroagencia.cl>"),
// MAIL_NOTIFY (a quién avisar de un lead nuevo; default contacto@faroagencia.cl).
// Si falta la key, no envía y devuelve { ok:false, skipped:true }: el resto del flujo sigue igual.

const API = 'https://api.resend.com/emails';

export const mailReady = () => !!process.env.RESEND_API_KEY;

export async function sendMail({ to, subject, html, text, replyTo }) {
  if (!mailReady()) return { ok: false, skipped: true };
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(API, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Faro° <informes@faroagencia.cl>',
        to: [to],
        subject,
        html,
        text,
        reply_to: replyTo || 'contacto@faroagencia.cl',
      }),
    });
    if (!r.ok) {
      console.error('[mail] Resend', r.status, (await r.text()).slice(0, 300));
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error('[mail] Resend error', e && e.name);
    return { ok: false };
  } finally {
    clearTimeout(id);
  }
}

export const notifyTo = () => process.env.MAIL_NOTIFY || 'contacto@faroagencia.cl';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const gradeOf = (n) => n >= 85 ? 'A' : n >= 70 ? 'B' : n >= 50 ? 'C' : n >= 30 ? 'D' : 'E';
const WA = 'https://wa.me/56986639327?text=' + encodeURIComponent('Hola Faro°, recibí mi informe y quiero mejorar mi web');

// Correo del informe para quien dejó sus datos. checks: [{cat,label,status,tip}] (ya saneados).
export function reportEmail({ name, url, score, checks }) {
  const raw = String(name || '').split(' ')[0];
  const first = raw ? raw.charAt(0).toLocaleUpperCase('es-CL') + raw.slice(1) : '';
  const grade = score == null ? '—' : gradeOf(score);
  const order = ['SEO', 'AEO / GEO', 'Social', 'Técnico'];
  const todo = checks.filter(c => c.status !== 'pass');
  const ok = checks.filter(c => c.status === 'pass');
  const icon = (s) => s === 'fail' ? '✗' : s === 'warn' ? '!' : '✓';
  const color = (s) => s === 'fail' ? '#D63A3A' : s === 'warn' ? '#C9770A' : '#1f8f5f';
  const rows = (list) => order.flatMap(cat => list.filter(c => c.cat === cat)).map(c => `
      <tr><td width="28" style="width:28px;padding:8px 10px;border-bottom:1px solid #E6EAF2;color:${color(c.status)};font-weight:700;font-family:Consolas,monospace">${icon(c.status)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E6EAF2"><strong style="color:#111420">${esc(c.label)}</strong>
      <span style="color:#98A0B4;font-family:Consolas,monospace;font-size:11px"> · ${esc(c.cat)}</span>
      ${c.status !== 'pass' && c.tip ? `<br><span style="color:#59617A;font-size:13px">${esc(c.tip)}</span>` : ''}</td></tr>`).join('');

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#EEF1F7;font-family:Segoe UI,Arial,Helvetica,sans-serif;color:#111420">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px">
    <div style="font-weight:800;font-size:22px;letter-spacing:-.5px">Faro<span style="color:#3D5AFE">°</span></div>
    <div style="background:#fff;border:1px solid #D5DBE8;border-radius:14px;padding:24px;margin-top:14px">
      <h1 style="font-size:22px;margin:0 0 8px">Hola${first ? ' ' + esc(first) : ''}, este es tu informe</h1>
      <p style="margin:0 0 16px;color:#59617A">Sitio analizado: <a href="${esc(url)}" style="color:#3D5AFE">${esc(url)}</a></p>
      <div style="display:inline-block;background:#0A0D17;color:#EAEDF6;border-radius:12px;padding:12px 18px;font-family:Consolas,monospace">
        Nota <strong style="font-size:22px;color:#fff">${esc(grade)}</strong> · ${score == null ? '—' : esc(score)}/100</div>
      ${todo.length ? `<h2 style="font-size:16px;margin:22px 0 6px">Qué mejorar (${todo.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows(todo)}</table>` : '<p style="margin-top:20px">Tu sitio pasó todos los puntos. 🎉</p>'}
      ${ok.length ? `<h2 style="font-size:16px;margin:22px 0 6px">Lo que ya está bien (${ok.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows(ok)}</table>` : ''}
      <p style="margin:22px 0 10px;color:#59617A">El informe en la web también incluye el rendimiento real (Google PageSpeed) y el chequeo de visibilidad en IA.</p>
      <p style="margin:18px 0 0"><a href="${WA}" style="display:inline-block;background:#3D5AFE;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">¿Lo dejamos en verde? Escríbenos</a></p>
    </div>
    <p style="font-size:12px;color:#98A0B4;margin-top:14px">Recibes este correo porque pediste tu informe en faroagencia.cl/analiza. Responde este correo si necesitas ayuda.
    · <a href="https://faroagencia.cl/privacidad" style="color:#98A0B4">Privacidad</a></p>
  </div></body></html>`;

  const text = `Hola${first ? ' ' + first : ''}, este es tu informe de ${url}\nNota ${grade} · ${score ?? '—'}/100\n\n` +
    (todo.length ? 'Qué mejorar:\n' + todo.map(c => `- [${c.status}] ${c.label}${c.tip ? ': ' + c.tip : ''}`).join('\n') + '\n\n' : '') +
    `¿Lo dejamos en verde? ${WA}\n\nFaro° · faroagencia.cl`;
  return { subject: `Tu informe de ${String(url).replace(/^https?:\/\//, '').replace(/\/$/, '')}: nota ${grade}`, html, text };
}

// Aviso interno de lead nuevo.
export function leadNoticeEmail({ name, email, url, score, marketing }) {
  const text = `Nuevo lead en /analiza\n\nNombre: ${name}\nCorreo: ${email}\nSitio: ${url || '—'}\nNota: ${score ?? '—'}\nAcepta novedades: ${marketing ? 'sí' : 'no'}\n\nVer todos: https://faroagencia.cl/api/leads`;
  const html = `<p><strong>Nuevo lead en /analiza</strong></p><p>Nombre: ${esc(name)}<br>Correo: <a href="mailto:${esc(email)}">${esc(email)}</a><br>Sitio: ${esc(url || '—')}<br>Nota: ${esc(score ?? '—')}<br>Acepta novedades: ${marketing ? 'sí' : 'no'}</p><p><a href="https://faroagencia.cl/api/leads">Ver todos los leads</a></p>`;
  return { subject: `Nuevo lead: ${name} (${String(url || '').replace(/^https?:\/\//, '')})`, html, text };
}
