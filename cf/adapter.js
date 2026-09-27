// Faro° — adaptador Cloudflare Pages Functions → handlers estilo Vercel.
// Permite que los mismos api/*.js corran en Vercel y en Cloudflare sin duplicar lógica.
// Traduce Request → req {method, query, body, headers} y res {status, setHeader, json, send, end} → Response.

// opts.cacheSeconds: si se define, las respuestas GET exitosas ("ok":true) se guardan en la caché de Cloudflare
// ese tiempo (clave = URL completa). Evita gastar cuota de Gemini/PSI con la misma URL. Solo en dominio propio.
export function adapt(load, opts = {}) {
  return async (context) => {
    const { request, env } = context;
    const cache = opts.cacheSeconds && request.method === 'GET' && typeof caches !== 'undefined' ? caches.default : null;
    if (cache) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    const response = await run(load, request, env);
    if (cache && response.status === 200) {
      const body = await response.clone().text();
      if (body.includes('"ok":true')) {
        const stored = new Response(body, response);
        stored.headers.set('Cache-Control', `public, s-maxage=${opts.cacheSeconds}`);
        context.waitUntil ? context.waitUntil(cache.put(request, stored)) : await cache.put(request, stored);
      }
    }
    return response;
  };
}

async function run(load, request, env) {
    // Los handlers leen process.env al importarse (ej. _db.js), así que se puebla ANTES del import.
    globalThis.process ??= { env: {} };
    globalThis.process.env ??= {};
    for (const [k, v] of Object.entries(env || {})) {
      if (typeof v === 'string') globalThis.process.env[k] = v;
    }
    const { default: handler } = await load();

    const url = new URL(request.url);
    let body;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const text = await request.text();
      body = text;
      if ((request.headers.get('content-type') || '').includes('application/json')) {
        try { body = JSON.parse(text); } catch { /* el handler decide qué hacer con el string */ }
      }
    }
    const req = {
      method: request.method,
      url: url.pathname + url.search,
      query: Object.fromEntries(url.searchParams),
      headers: Object.fromEntries(request.headers),
      body,
    };

    return new Promise((resolve) => {
      let status = 200;
      let sent = false;
      const headers = new Headers();
      const res = {
        status(code) { status = code; return res; },
        setHeader(k, v) { headers.set(k, String(v)); return res; },
        getHeader(k) { return headers.get(k); },
        json(obj) {
          if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8');
          return res.send(JSON.stringify(obj));
        },
        send(b) {
          if (!sent) { sent = true; resolve(new Response(b ?? null, { status, headers })); }
          return res;
        },
        end(b) { return res.send(b); },
      };
      Promise.resolve(handler(req, res))
        .then(() => { if (!sent) res.send(null); })
        .catch(() => {
          if (sent) return;
          sent = true;
          resolve(new Response(JSON.stringify({ ok: false, error: 'Error interno.' }), {
            status: 500, headers: { 'content-type': 'application/json; charset=utf-8' },
          }));
        });
    });
}
