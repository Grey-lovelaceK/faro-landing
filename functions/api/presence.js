// Cloudflare Pages Function → reutiliza api/presence.js (ver cf/adapter.js).
import { adapt } from '../../cf/adapter.js';
export const onRequest = adapt(() => import('../../api/presence.js'), { cacheSeconds: 86400 });
