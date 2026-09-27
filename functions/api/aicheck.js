// Cloudflare Pages Function → reutiliza api/aicheck.js (ver cf/adapter.js).
import { adapt } from '../../cf/adapter.js';
export const onRequest = adapt(() => import('../../api/aicheck.js'));
