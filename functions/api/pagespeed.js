// Cloudflare Pages Function → reutiliza api/pagespeed.js (ver cf/adapter.js).
import { adapt } from '../../cf/adapter.js';
export const onRequest = adapt(() => import('../../api/pagespeed.js'), { cacheSeconds: 3600 });
