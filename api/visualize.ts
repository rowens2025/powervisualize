import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { listMortgageMetrics, MORTGAGE_METRICS, DEFAULT_LIMIT, type VizSpec } from './lib/mortgageMetrics.js';
import { runMortgageChart } from './lib/runViz.js';

/**
 * Mortgage Portfolio Intelligence visualization endpoint — the engine behind
 * "Build a visualization with RyAgent". Runs governed, read-only queries over
 * the Fannie Mae warehouse; the model only picks a metricId, never writes SQL.
 *
 * Modes:
 *   { mode: 'list' }                   -> catalog of chartable metrics (UI chips)
 *   { mode: 'run',     spec }          -> execute {metricId, chartType, limit}
 *   { mode: 'resolve', description }   -> map an NL ask -> spec, then run
 */

// lightweight per-process IP rate limiting
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;
const rateMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: VercelRequest): string {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string' && xfwd.length > 0) return xfwd.split(',')[0].trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) return realIp;
  return req.socket?.remoteAddress || 'unknown';
}
function rateLimited(req: VercelRequest): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

/** Cheap NL -> spec mapping; keyword fallback if model/key unavailable. */
async function resolveDescription(description: string): Promise<VizSpec> {
  const fallback = keywordMatch(description);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const catalog = MORTGAGE_METRICS.map(
    (m) => `- ${m.id}: ${m.label} — ${m.description} (charts: ${m.chartTypes.join('/')})`,
  ).join('\n');

  const system = `You map a user's request about a Fannie Mae mortgage portfolio to exactly one metric from a fixed catalog.
Respond ONLY with JSON: {"metricId": string, "chartType": "line"|"area"|"bar"|"horizontalBar"|"pie", "limit": number}.
- metricId MUST be one of the catalog ids. If nothing fits, pick the closest.
- chartType MUST be one the chosen metric supports.
- limit is top-N categories (3-25), default ${DEFAULT_LIMIT}; only matters for breakdowns.

CATALOG:
${catalog}`;

  try {
    const client = new OpenAI({ apiKey });
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: description.slice(0, 400) },
      ],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(resp.choices[0]?.message?.content || '{}');
    if (parsed && typeof parsed.metricId === 'string') {
      return { metricId: parsed.metricId, chartType: parsed.chartType, limit: typeof parsed.limit === 'number' ? parsed.limit : undefined };
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

function keywordMatch(description: string): VizSpec {
  const lower = description.toLowerCase();
  const scored = MORTGAGE_METRICS.map((m) => {
    const hay = `${m.label} ${m.description} ${m.example} ${m.categoryLabel} ${m.measureLabel}`.toLowerCase();
    const words = Array.from(new Set(lower.split(/\W+/).filter((w) => w.length > 3)));
    const score = words.reduce((acc, w) => (hay.includes(w) ? acc + 1 : acc), 0);
    return { id: m.id, score };
  }).sort((a, b) => b.score - a.score);
  return { metricId: scored[0]?.score > 0 ? scored[0].id : MORTGAGE_METRICS[0].id };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }
  if (rateLimited(req)) {
    res.status(429).json({ error: 'Rate limit exceeded. Please try again shortly.' });
    return;
  }

  try {
    const mode = req.body?.mode as string | undefined;

    if (mode === 'list' || !mode) {
      res.status(200).json({ metrics: listMortgageMetrics() });
      return;
    }

    if (mode === 'run') {
      const spec = req.body?.spec as VizSpec | undefined;
      if (!spec || typeof spec.metricId !== 'string') {
        res.status(400).json({ error: 'Missing spec.metricId' });
        return;
      }
      const out = await runMortgageChart(spec);
      if (!out.ok) {
        res.status(out.error.includes('not configured') ? 503 : 400).json({ error: out.error });
        return;
      }
      res.status(200).json(out);
      return;
    }

    if (mode === 'resolve') {
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
      if (!description) {
        res.status(400).json({ error: 'Missing description' });
        return;
      }
      const spec = await resolveDescription(description);
      const out = await runMortgageChart(spec);
      if (!out.ok) {
        res.status(out.error.includes('not configured') ? 503 : 400).json({ error: out.error });
        return;
      }
      res.status(200).json({ ...out, resolvedFrom: description, spec });
      return;
    }

    res.status(400).json({ error: `Unknown mode "${mode}". Use list | run | resolve.` });
  } catch (err: any) {
    console.error('[API] /api/visualize error:', err?.message ?? err);
    res.status(500).json({ error: 'Server error while building the visualization.' });
  }
}
