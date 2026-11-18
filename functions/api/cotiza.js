// Cloudflare Pages Function → reutiliza api/cotiza.js (ver cf/adapter.js). POST, sin caché.
import { adapt } from '../../cf/adapter.js';
export const onRequest = adapt(() => import('../../api/cotiza.js'));
