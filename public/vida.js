// Faro° — vida.js: interacción compartida (portada y páginas de servicio). Vanilla, sin dependencias.
// Todo es mejora: sin este archivo la página se ve completa. Con prefers-reduced-motion no se mueve nada,
// y lo que sigue al puntero solo corre con mouse (hover + puntero fino), nunca en táctil.
(function () {
  var mm = function (q) { return !!(window.matchMedia && matchMedia(q).matches); };
  var calm = mm('(prefers-reduced-motion: reduce)');
  var fine = mm('(hover: hover) and (pointer: fine)');
  var clamp = function (v) { return v < -1 ? -1 : v > 1 ? 1 : v; };

  // 1) Aparición escalonada. Solo lo que está bajo el pliegue al cargar; escalón por grupo de hermanos.
  //    En las cabeceras entra el título, luego la bajada y luego el enlace (no el bloque entero).
  function reveal() {
    if (calm || !('IntersectionObserver' in window)) return;
    var fold = innerHeight;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add(e.target.classList.contains('steps') ? 'lit' : 'in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    var groups = ['.sec-head > *', '.path-grid > li', '.vis-row', '.anl-island', '.plan', '.extra', '.person', '.faq-list details', '.night', '.step', '.doc .cta', '.doc .related'];
    groups.forEach(function (sel) {
      var i = 0, last = null;
      document.querySelectorAll('main ' + sel).forEach(function (el) {
        if (el.getBoundingClientRect().top < fold) return;
        if (el.parentElement !== last) { i = 0; last = el.parentElement; }
        el.style.setProperty('--i', i++); el.classList.add('rv'); io.observe(el);
      });
    });
    var st = document.querySelector('main .steps');
    if (st && st.getBoundingClientRect().top >= fold) { st.classList.add('dim'); io.observe(st); }
  }

  // 2) Luz de borde que sigue al puntero: [data-spot] recibe --mx/--my (px) y el CSS dibuja el haz.
  function spot() {
    var raf = 0, ev = null;
    function tick() {
      raf = 0;
      var t = ev && ev.target && ev.target.closest ? ev.target.closest('[data-spot]') : null;
      if (!t) return;
      var r = t.getBoundingClientRect();
      t.style.setProperty('--mx', (ev.clientX - r.left).toFixed(1) + 'px');
      t.style.setProperty('--my', (ev.clientY - r.top).toFixed(1) + 'px');
    }
    document.addEventListener('pointermove', function (e) { ev = e; if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
  }

  // 3) [data-follow]: el elemento recibe --fx/--fy entre -1 y 1 según dónde está el puntero dentro de su área
  //    ([data-follow-area]), con inercia. En la portada mueve el halo de la tarjeta de IA: el visitante apunta el faro.
  function follow() {
    document.querySelectorAll('[data-follow]').forEach(function (el) {
      var area = el.closest('[data-follow-area]') || el;
      var tx = 0, ty = 0, x = 0, y = 0, run = 0;
      function loop() {
        x += (tx - x) * 0.07; y += (ty - y) * 0.07;
        el.style.setProperty('--fx', x.toFixed(3)); el.style.setProperty('--fy', y.toFixed(3));
        run = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(loop) : 0;
      }
      function go() { if (!run) run = requestAnimationFrame(loop); }
      area.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        tx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2));
        ty = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2));
        go();
      }, { passive: true });
      area.addEventListener('pointerleave', function () { tx = 0; ty = 0; go(); });
    });
  }

  // 4) [data-magnet]: un solo CTA por página se acerca al puntero (propiedad translate, no pisa el transform del hover).
  function magnet() {
    document.querySelectorAll('[data-magnet]').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.translate = ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px ' + ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + 'px';
      });
      b.addEventListener('pointerleave', function () { b.style.translate = ''; });
    });
  }

  function init() {
    reveal();
    if (calm || !fine) return;
    spot(); follow(); magnet();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
