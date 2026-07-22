import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runSportsQuery, runSportsCombo, runSportsDerived, listSportsDimensionValues, getSportsStatus } from '../_lib/runSports.js';
import { buildSportsStat, type SportsStatSpec } from '../_lib/sportsStats.js';
import type { SportsQuery } from '../_lib/sportsMetrics.js';

/**
 * Single governed sports query endpoint. The AI (or the dashboard) writes a
 * compact query object here; we resolve it against the semantic layer and run
 * one read-only SQL statement. See /api/sports/meta for the queryable metrics.
 *
 *   POST { metric, season?, team?, sort?, limit?, chartType? }  -> { chartSpec, rows }
 *   POST { mode: 'stat', metric, season?, team?, sort?, label? } -> { stat }
 *   POST { mode: 'values', dimension }                           -> { values }
 */

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 40;
const rateMap = new Map<string, { count: number; resetAt: number }>();
function rateLimited(req: VercelRequest): boolean {
  const xfwd = req.headers['x-forwarded-for'];
  const ip = (typeof xfwd === 'string' && xfwd.split(',')[0].trim()) || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  if (rateLimited(req)) return res.status(429).json({ error: 'Rate limit exceeded. Please try again shortly.' });

  try {
    if (req.body?.mode === 'status') {
      return res.status(200).json(await getSportsStatus());
    }

    if (req.body?.mode === 'values') {
      const dimension = typeof req.body?.dimension === 'string' ? req.body.dimension : '';
      if (!dimension) return res.status(400).json({ error: 'Missing dimension' });
      return res.status(200).json({ dimension, values: await listSportsDimensionValues(dimension) });
    }

    if (req.body?.mode === 'combo') {
      const b = req.body;
      if (typeof b.metricA !== 'string' || typeof b.metricB !== 'string') {
        return res.status(400).json({ error: 'combo needs metricA and metricB (two breakdown metric ids).' });
      }
      const out = await runSportsCombo({ metricA: b.metricA, metricB: b.metricB, season: b.season, sort: b.sort, limit: b.limit });
      if (!out.ok) return res.status(400).json({ error: out.error });
      return res.status(200).json(out);
    }

    if (req.body?.mode === 'derived') {
      const b = req.body;
      if (typeof b.metricA !== 'string' || typeof b.metricB !== 'string' || typeof b.op !== 'string') {
        return res.status(400).json({ error: 'derived needs metricA, metricB and op (ratio|difference|sum|product).' });
      }
      const out = await runSportsDerived({ metricA: b.metricA, metricB: b.metricB, op: b.op, label: b.label, season: b.season, sort: b.sort, limit: b.limit });
      if (!out.ok) return res.status(400).json({ error: out.error });
      return res.status(200).json(out);
    }

    if (req.body?.mode === 'stat') {
      const spec = req.body as SportsStatSpec & { mode: string };
      if (typeof spec.metric !== 'string') return res.status(400).json({ error: 'Missing required field: metric.' });
      const out = await buildSportsStat({ metric: spec.metric, season: spec.season, team: spec.team, sort: spec.sort, label: spec.label });
      if (!out.ok) return res.status(400).json({ error: out.error });
      return res.status(200).json({ stat: out.stat });
    }

    const q = req.body as SportsQuery;
    if (!q || typeof q.metric !== 'string') {
      return res.status(400).json({ error: 'Missing required field: metric. GET /api/sports/meta to see options.' });
    }
    const out = await runSportsQuery(q);
    if (!out.ok) return res.status(400).json({ error: out.error });
    return res.status(200).json(out);
  } catch (err: any) {
    console.error('[API] /api/sports/query error:', err?.message ?? err);
    return res.status(500).json({ error: 'Server error while running the sports query.' });
  }
}
