import { dispatch } from './router.js';

export const config = { maxDuration: 15 };

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  const raw = req.query?.p;
  const path = (Array.isArray(raw) ? raw.join('/') : String(raw || '')).replace(/^\/+|\/+$/g, '');
  let body: Record<string, unknown> = {};
  if (req.body && typeof req.body === 'object') body = req.body;
  else if (typeof req.body === 'string' && req.body) {
    try {
      body = JSON.parse(req.body);
    } catch {
      body = {};
    }
  }
  const authz = String(req.headers?.authorization || '');
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  const ip = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const r = await dispatch(path, { body, token, ip, user: null });
  res.status(r.status).json(r.body);
}
