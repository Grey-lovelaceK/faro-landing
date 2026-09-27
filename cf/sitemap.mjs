// Faro° — genera dist/sitemap.xml después de `astro build`, a partir del <link rel="canonical">
// de cada página publicada (menos la 404 y las que tengan noindex). lastmod = article:modified_time.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) pages.push(p);
  }
})(DIST);

const urls = [];
for (const file of pages) {
  if (relative(DIST, file).split('\\').join('/') === '404.html') continue;
  const html = readFileSync(file, 'utf8');
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
  const loc = (html.match(/<link rel="canonical" href="([^"]+)"/i) || [])[1];
  if (!loc) { console.warn('sin canonical, fuera del sitemap:', file); continue; }
  const mod = (html.match(/<meta property="article:modified_time" content="(\d{4}-\d{2}-\d{2})/i) || [])[1];
  urls.push({ loc, mod });
}
urls.sort((a, b) => a.loc.length - b.loc.length || a.loc.localeCompare(b.loc));
writeFileSync(join(DIST, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => `  <url><loc>${u.loc}</loc>${u.mod ? `<lastmod>${u.mod}</lastmod>` : ''}</url>`).join('\n') +
  '\n</urlset>\n');
console.log(`sitemap.xml: ${urls.length} URLs`);
