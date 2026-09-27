// Faro° — GA4 con Consent Mode v2 + aviso de cookies + eventos de conversión.
// Se carga en todas las páginas con <script src="/analytics.js" defer>.
// Por defecto el consentimiento está DENEGADO: GA4 solo recibe pings sin cookies hasta que el
// visitante acepta. La elección se guarda en localStorage (si el navegador lo permite).
// Nunca se envían datos personales: ni el nombre ni el correo del lead, solo que ocurrió.
(function () {
  var GA_ID = 'G-T1F3G9NP1G';
  var KEY = 'faro-consent'; // 'granted' | 'denied'

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var granted = saved === 'granted' ? 'granted' : 'denied';

  gtag('consent', 'default', {
    analytics_storage: granted,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });
  gtag('js', new Date());
  gtag('config', GA_ID);

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  function track(name, params) { try { gtag('event', name, params || {}); } catch (e) {} }
  window.faroTrack = track;

  // Conversiones del analizador sin tocar el JS de cada página: observamos las llamadas a /api/*.
  if (window.fetch) {
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = ((init && init.method) || 'GET').toUpperCase();
      var p = origFetch.apply(this, arguments);
      p.then(function (r) {
        if (!r || !r.ok) return;
        if (url.indexOf('/api/analyze') === 0) track('analyze_site');
        else if (url.indexOf('/api/lead') === 0 && method === 'POST') track('generate_lead', { lead_source: 'analizador' });
      }).catch(function () {});
      return p;
    };
  }

  // Clics de contacto (correo y WhatsApp).
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('mailto:') === 0) track('contact', { method: 'email', page: location.pathname });
    else if (href.indexOf('wa.me/') !== -1) track('contact', { method: 'whatsapp', page: location.pathname });
  }, true);

  // Aviso de cookies: solo si todavía no hay elección guardada.
  if (saved === 'granted' || saved === 'denied') return;

  function choose(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
    gtag('consent', 'update', { analytics_storage: value });
    var el = document.getElementById('faro-consent');
    if (el) el.remove();
  }

  function showBanner() {
    var css = document.createElement('style');
    css.textContent =
      '#faro-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:100;max-width:560px;margin-inline:auto;' +
      'background:var(--surface,#fff);color:var(--ink,#111420);border:1px solid var(--border,#D5DBE8);border-radius:14px;' +
      'box-shadow:0 12px 32px -12px rgba(0,0,0,.35);padding:16px 18px;display:flex;flex-wrap:wrap;gap:12px 16px;align-items:center;' +
      'font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}' +
      '#faro-consent p{margin:0;flex:1 1 260px;color:var(--muted,#59617A)}' +
      '#faro-consent a{color:var(--accent,#3D5AFE)}' +
      '#faro-consent .b{display:flex;gap:8px}' +
      '#faro-consent button{cursor:pointer;font:600 13px/1 inherit;font-family:inherit;padding:9px 16px;border-radius:999px;border:1px solid var(--border,#D5DBE8);background:transparent;color:var(--ink,#111420)}' +
      '#faro-consent button.ok{background:var(--accent,#3D5AFE);border-color:var(--accent,#3D5AFE);color:#fff}' +
      '#faro-consent button:focus-visible{outline:2px solid var(--accent,#3D5AFE);outline-offset:2px}';
    document.head.appendChild(css);

    var box = document.createElement('div');
    box.id = 'faro-consent';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Aviso de cookies');
    box.innerHTML =
      '<p>Usamos cookies de analítica (Google Analytics) para saber qué partes del sitio sirven. ' +
      'No usamos cookies publicitarias. <a href="/privacidad">Política de privacidad</a></p>' +
      '<div class="b"><button type="button" data-v="denied">Rechazar</button>' +
      '<button type="button" class="ok" data-v="granted">Aceptar</button></div>';
    box.addEventListener('click', function (ev) {
      var v = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-v');
      if (v) choose(v);
    });
    document.body.appendChild(box);
  }

  if (document.body) showBanner();
  else document.addEventListener('DOMContentLoaded', showBanner);
})();
