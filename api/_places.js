// Faro° — dato real del Perfil de Empresa en Google (Places API New, Text Search).
// El "_" evita que se enrute como endpoint. Lo usa api/presence.js para no adivinar las reseñas.
// Devuelve el conteo real de reseñas y la nota, o { ok:false } para que presence degrade al framing honesto.
// Env: GOOGLE_PLACES_KEY (misma que usa tools/prospectar.cjs). Debe existir como secret en el hosting.

const URL = 'https://places.googleapis.com/v1/places:searchText';
// fieldMask exacta: pedir de más sube el tier de facturación (mismo criterio que prospectar.cjs).
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.googleMapsUri',
].join(',');

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// ¿El lugar que devolvió Google es de verdad el negocio que buscamos? (defensa contra el match equivocado)
function matches(name, displayName) {
  const a = new Set(norm(name).split(' ').filter(w => w.length > 2));
  const b = new Set(norm(displayName).split(' ').filter(w => w.length > 2));
  if (!a.size || !b.size) return false;
  let hit = 0;
  for (const w of a) if (b.has(w)) hit++;
  return hit / a.size >= 0.5; // al menos la mitad de las palabras del nombre buscado aparecen
}

/**
 * placeStats(name, comuna) → { ok, configured, place:{ id, name, rating, userRatingCount, googleMapsUri, address, status } }
 * ok:false con configured:false si falta la key; ok:false si no hay match confiable o la API falla.
 */
export async function placeStats(name, comuna, { ms = 9000 } = {}) {
  const key = (process.env.GOOGLE_PLACES_KEY || '').trim();
  if (!key) return { ok: false, configured: false, error: 'sin GOOGLE_PLACES_KEY' };

  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${name} ${comuna} Chile`,
        languageCode: 'es-CL',
        regionCode: 'CL',
        maxResultCount: 3,
      }),
      signal: ctrl.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (data.error && data.error.message) || `HTTP ${r.status}`;
      console.error('[places]', r.status, String(msg).slice(0, 200));
      return { ok: false, configured: true, quota: r.status === 429 || r.status === 402, error: msg };
    }
    const list = Array.isArray(data.places) ? data.places : [];
    const hit = list.find(p => matches(name, p.displayName?.text || ''));
    if (!hit) return { ok: false, configured: true, error: 'sin match confiable' };
    return {
      ok: true,
      configured: true,
      place: {
        id: hit.id || null,
        name: hit.displayName?.text || null,
        rating: typeof hit.rating === 'number' ? hit.rating : null,
        userRatingCount: typeof hit.userRatingCount === 'number' ? hit.userRatingCount : 0,
        googleMapsUri: hit.googleMapsUri || null,
        address: hit.formattedAddress || null,
        status: hit.businessStatus || null,
      },
    };
  } catch (e) {
    return { ok: false, configured: true, error: 'Places: ' + (e.name === 'AbortError' ? 'tiempo agotado' : e.message) };
  } finally {
    clearTimeout(id);
  }
}
