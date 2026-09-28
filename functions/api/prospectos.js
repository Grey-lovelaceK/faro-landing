// Cloudflare Pages Function → reutiliza api/prospectos.js (ver cf/adapter.js). Sin caché: es interno y cambia.
import { adapt } from '../../cf/adapter.js';
export const onRequest = adapt(() => import('../../api/prospectos.js'));
