import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeSportsLayer } from '../lib/sportsMetrics.js';

/**
 * Sports semantic-layer meta endpoint — the plain-English "read me first" for
 * the AI (and humans, via Swagger/Scalar). It explains every metric, dimension,
 * and how to write a query for POST /api/sports/query. No data, just definitions.
 *
 *   GET /api/sports/meta -> { dataset, grain, metrics[], dimensions[], queryFormat }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json(describeSportsLayer());
}
