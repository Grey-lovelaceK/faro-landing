// Cloudflare Pages Function → reutiliza api/lead.js (ver cf/adapter.js).
import { adapt } from '../../cf/adapter.js';
export const onRequest = adapt(() => import('../../api/lead.js'));
