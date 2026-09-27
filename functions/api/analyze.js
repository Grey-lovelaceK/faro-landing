// Cloudflare Pages Function → reutiliza api/analyze.js (ver cf/adapter.js).
import { adapt } from '../../cf/adapter.js';
export const onRequest = adapt(() => import('../../api/analyze.js'), { cacheSeconds: 600 });
