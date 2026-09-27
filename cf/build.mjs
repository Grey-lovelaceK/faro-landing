// Faro° — build para Cloudflare Pages: copia solo lo público a dist/.
// Evita publicar el repo entero (api/, .claude/, CLAUDE.md, node_modules, etc.).
import { mkdirSync, rmSync, readdirSync, copyFileSync } from 'node:fs';

const PUBLIC = /\.(html|txt|xml|ico|png|svg|webp|jpg|json|js|css)$/i;
const SKIP = new Set(['package.json', 'package-lock.json', 'vercel.json']);

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
const files = readdirSync('.', { withFileTypes: true })
  .filter(f => f.isFile() && PUBLIC.test(f.name) && !SKIP.has(f.name));
for (const f of files) copyFileSync(f.name, 'dist/' + f.name);
console.log('dist/:', files.map(f => f.name).join(', '));
