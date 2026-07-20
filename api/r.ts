import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from './_db.js';

/**
 * Per-employer tracking redirect: /r/<token> logs the visit (who/when/where) into
 * jobhunt.link_clicks, then 302s into the site. Tokens are created in Kestrel and
 * only known tokens log (FK to jobhunt.link_tokens). Logging is best-effort and
 * never blocks the redirect. Company-from-IP is filled in only if IPINFO_TOKEN is set.
 */
function firstIp(xff: string | string[] | undefined): string | null {
  const s = Array.isArray(xff) ? xff[0] : xff;
  return (typeof s === 'string' && s.split(',')[0].trim()) || null;
}
function hdr(req: VercelRequest, name: string): string | null {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v) || null;
}

async function companyFromIp(ip: string | null): Promise<string | null> {
  const token = process.env.IPINFO_TOKEN;
  if (!token || !ip) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`https://ipinfo.io/${ip}?token=${token}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const d: any = await r.json();
    return d.org || d.company?.name || null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = String(req.query.token || '').slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
  const toRaw = typeof req.query.to === 'string' ? req.query.to : '/';
  const dest = toRaw.startsWith('/') && !toRaw.startsWith('//') ? toRaw : '/';

  if (token) {
    try {
      const ip = firstIp(req.headers['x-forwarded-for']) || req.socket?.remoteAddress || null;
      const geo =
        [hdr(req, 'x-vercel-ip-city'), hdr(req, 'x-vercel-ip-country-region'), hdr(req, 'x-vercel-ip-country')]
          .filter(Boolean)
          .join(', ') || null;
      const company = await companyFromIp(ip);
      await pool.query(
        `insert into jobhunt.link_clicks (token, ip, user_agent, referer, geo, company_guess)
         values ($1,$2,$3,$4,$5,$6)`,
        [token, ip, hdr(req, 'user-agent'), hdr(req, 'referer'), geo, company],
      );
    } catch (e: any) {
      // Unknown token (FK) or transient DB issue — never block the visit.
      console.error('[r] log failed:', e?.message || e);
    }
  }

  res.setHeader('Location', dest);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(302).end();
}
