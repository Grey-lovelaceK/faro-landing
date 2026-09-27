// Faro° — build para Cloudflare Pages: copia solo lo público a dist/ y genera sitemap.xml.
// Evita publicar el repo entero (api/, .claude/, CLAUDE.md, node_modules, etc.).
// - Raíz: archivos con extensión pública (html, txt, xml, imágenes, js, css).
// - blog/: se publica completo salvo archivos que empiezan con "_" (plantillas y borradores).
// - sitemap.xml: se arma con el <link rel="canonical"> de cada página publicada (menos la 404 y
//   las páginas con noindex). lastmod sale de <meta property="article:modified_time"> si existe.
import { mkdirSync, rmSync, readdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const PUBLIC = /\.(html|txt|xml|ico|png|svg|webp|jpg|json|js|css)$/i;
const SKIP = new Set(['package.json', 'package-lock.json', 'vercel.json', 'sitemap.xml']);
const DIRS = ['blog'];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');

const published = [];
const copy = (from, to) => { copyFileSync(from, to); published.push(to.slice('dist/'.length)); };

for (const f of readdirSync('.', { withFileTypes: true })) {
  if (f.isFile() && PUBLIC.test(f.name) && !SKIP.has(f.name)) copy(f.name, 'dist/' + f.name);
}
for (const dir of DIRS) {
  if (!existsSync(dir)) continue;
  mkdirSync('dist/' + dir, { recursive: true });
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (f.isFile() && PUBLIC.test(f.name) && !f.name.startsWith('_')) copy(`${dir}/${f.name}`, `dist/${dir}/${f.name}`);
  }
}

// sitemap.xml
const urls = [];
for (const path of published.filter(p => p.endsWith('.html') && p !== '404.html')) {
  const html = readFileSync('dist/' + path, 'utf8');
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
  const loc = (html.match(/<link rel="canonical" href="([^"]+)"/i) || [])[1];
  if (!loc) { console.warn('sin canonical, fuera del sitemap:', path); continue; }
  const mod = (html.match(/<meta property="article:modified_time" content="(\d{4}-\d{2}-\d{2})/i) || [])[1];
  urls.push({ loc, mod });
}
urls.sort((a, b) => a.loc.length - b.loc.length || a.loc.localeCompare(b.loc));
writeFileSync('dist/sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => `  <url><loc>${u.loc}</loc>${u.mod ? `<lastmod>${u.mod}</lastmod>` : ''}</url>`).join('\n') +
  '\n</urlset>\n');

console.log('dist/:', published.join(', '));
console.log('sitemap:', urls.map(u => u.loc).join(', '));
