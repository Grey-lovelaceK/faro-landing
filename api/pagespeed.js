// Faro° — Rendimiento real vía Google PageSpeed Insights (Lighthouse + CrUX).
// GET /api/pagespeed?url=...&strategy=mobile|desktop
// Funciona SIN key (cuota baja de Google). Con env PAGESPEED_API_KEY sube la cuota.
// Devuelve score de rendimiento + Core Web Vitals (lab siempre; campo/CrUX si existe).

export const config = { maxDuration: 60 };

const PSI = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export default async function handler(req, res) {
  const raw = (req.query && req.query.url) || '';
  let target = String(raw).trim();
  if (!target) return res.status(400).json({ ok: false, error: 'Falta la URL.' });
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
  try { new URL(target); } catch { return res.status(400).json({ ok: false, error: 'URL inválida.' }); }

  const strategy = (req.query.strategy === 'desktop') ? 'desktop' : 'mobile';

  const params = new URLSearchParams({ url: target, strategy, category: 'performance' });
  if (process.env.PAGESPEED_API_KEY) params.set('key', process.env.PAGESPEED_API_KEY);

  let data;
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 55000);
    let r;
    try { r = await fetch(PSI + '?' + params.toString(), { signal: ctrl.signal }); }
    finally { clearTimeout(id); }
    data = await r.json();
    if (!r.ok || data.error) {
      const msg = (data.error && data.error.message) || `HTTP ${r.status}`;
      return res.status(200).json({ ok: false, error: 'PageSpeed no pudo analizar el sitio. (' + msg + ')' });
    }
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'PageSpeed tardó demasiado o falló. Intenta de nuevo.' });
  }

  const lh = data.lighthouseResult || {};
  const audits = lh.audits || {};
  const perfScore = lh.categories && lh.categories.performance ? Math.round(lh.categories.performance.score * 100) : null;

  const num = (id) => (audits[id] && typeof audits[id].numericValue === 'number') ? audits[id].numericValue : null;
  const disp = (id) => (audits[id] && audits[id].displayValue) || null;

  // Lab (Lighthouse) — siempre disponible
  const lab = {
    lcp: { ms: num('largest-contentful-paint'), display: disp('largest-contentful-paint') },
    cls: { value: num('cumulative-layout-shift'), display: disp('cumulative-layout-shift') },
    tbt: { ms: num('total-blocking-time'), display: disp('total-blocking-time') }, // proxy lab de INP
    fcp: { ms: num('first-contentful-paint'), display: disp('first-contentful-paint') },
    si:  { ms: num('speed-index'), display: disp('speed-index') },
  };

  // Campo real (CrUX) — solo si el sitio tiene tráfico suficiente
  const le = data.loadingExperience && data.loadingExperience.metrics ? data.loadingExperience.metrics : null;
  const fieldMetric = (k) => {
    const m = le && le[k];
    if (!m) return null;
    return { p75: m.percentile, category: m.category }; // FAST/AVERAGE/SLOW o GOOD/NEEDS_IMPROVEMENT/SLOW
  };
  const field = le ? {
    lcp: fieldMetric('LARGEST_CONTENTFUL_PAINT_MS'),
    cls: fieldMetric('CUMULATIVE_LAYOUT_SHIFT_SCORE'),
    inp: fieldMetric('INTERACTION_TO_NEXT_PAINT') || fieldMetric('EXPERIMENTAL_INTERACTION_TO_NEXT_PAINT'),
    fcp: fieldMetric('FIRST_CONTENTFUL_PAINT_MS'),
  } : null;

  res.setHeader('Cache-Control', 's-maxage=600');
  return res.status(200).json({
    ok: true,
    url: (lh.finalUrl || target),
    strategy,
    perfScore,
    lab,
    field,
    hasKey: !!process.env.PAGESPEED_API_KEY,
  });
}
