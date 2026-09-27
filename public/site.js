// Faro° — UI compartida: selector de tema claro/oscuro + botón flotante de WhatsApp.
// Se carga SIN defer en el <head> para aplicar el tema guardado antes de pintar (sin parpadeo).
// Cada página ya define sus tokens para :root[data-theme="light"|"dark"]; acá solo se elige cuál.
(function () {
  var KEY = 'faro-theme';
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  // Claro por defecto: el oscuro solo se activa si el visitante lo elige con el botón (se guarda en localStorage).
  root.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');

  function current() {
    var t = root.getAttribute('data-theme');
    return t === 'dark' ? 'dark' : 'light';
  }

  var SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var WA_ICON = '<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><path fill="#fff" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7zm5.9-8c-.3-.2-1.9-1-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.1-1.2 2.8 1.2 3.2 1.4 3.4 2.4 3.6 5.8 5c2.1.9 3 1 4 .8.7-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5 0-.2-.3-.3-.6-.4z"/></svg>';

  var MSG = {
    '/integraciones': 'Hola Faro°, quiero un diagnóstico de integración',
    '/analiza': 'Hola Faro°, analicé mi web y quiero mejorarla',
  };
  function waLink() {
    var p = location.pathname.replace(/\/$/, '') || '/';
    var msg = MSG[p] || (p.indexOf('/blog') === 0 ? 'Hola Faro°, leí su blog' : 'Hola Faro°, vengo desde su sitio web');
    return 'https://wa.me/56986639327?text=' + encodeURIComponent(msg);
  }

  function css() {
    var s = document.createElement('style');
    s.textContent =
      '.theme-btn{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:999px;cursor:pointer;' +
      'background:transparent;border:1px solid var(--border,#D5DBE8);color:var(--ink,#111420);flex:0 0 auto;margin-left:10px;padding:0;transition:border-color .15s,color .15s}' +
      '.theme-btn:hover{border-color:var(--accent,#3D5AFE);color:var(--accent,#3D5AFE)}' +
      '.theme-btn:focus-visible,.wa-float:focus-visible{outline:2px solid var(--accent,#3D5AFE);outline-offset:3px}' +
      '.wa-float{position:fixed;right:18px;bottom:18px;z-index:90;width:56px;height:56px;border-radius:50%;background:#25D366;' +
      'display:grid;place-items:center;box-shadow:0 8px 24px -6px rgba(0,0,0,.45);transition:transform .15s}' +
      '.wa-float:hover{transform:translateY(-2px)}' +
      '@media (max-width:520px){.wa-float{right:14px;bottom:14px;width:52px;height:52px}}' +
      '@media (prefers-reduced-motion:reduce){.theme-btn,.wa-float{transition:none}}' +
      '@media print{.wa-float,.theme-btn{display:none}}';
    document.head.appendChild(s);
  }

  function themeButton() {
    var host = document.querySelector('nav.bar .container, header.bar .in, .wrap > header');
    if (!host) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-btn';
    function paint() {
      var dark = current() === 'dark';
      b.innerHTML = dark ? SUN : MOON;
      b.setAttribute('aria-label', dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
      b.title = b.getAttribute('aria-label');
    }
    b.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      paint();
    });
    paint();
    // Con botón CTA (portada, integraciones): el tema va pegado a su izquierda y ambos a la derecha.
    var cta = host.querySelector(':scope > .btn');
    if (cta) { b.style.marginLeft = 'auto'; cta.style.marginLeft = '10px'; host.insertBefore(b, cta); }
    else host.appendChild(b);
  }

  function waButton() {
    if (document.querySelector('.wa-float')) return;
    var a = document.createElement('a');
    a.className = 'wa-float';
    a.href = waLink();
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Escríbenos por WhatsApp');
    a.innerHTML = WA_ICON;
    document.body.appendChild(a);
  }

  function init() { css(); themeButton(); waButton(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
