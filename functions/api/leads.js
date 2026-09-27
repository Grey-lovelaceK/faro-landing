// Cloudflare Pages Function → reutiliza api/leads.js (ver cf/adapter.js).
import { adapt } from '../../cf/adapter.js';
export const onRequest = adapt(() => import('../../api/leads.js'));
