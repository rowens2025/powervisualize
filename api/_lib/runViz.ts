/**
 * Shared mortgage chart runner — used by both /api/visualize (the button flow)
 * and /api/chat (the agent's build_visualization tool). Read-only.
 */
import { fanniePool } from './fannieDb.js';
import { resolveSpec, listDimensions, dimensionValueSource, type ChartType, type VizSpec } from './mortgageMetrics.js';

/** Selectable values for a dimension, to populate an interactive dropdown filter. */
export async function listDimensionValues(dimension: string): Promise<{ code: string; label: string }[]> {
  const dimDef = listDimensions().find((d) => d.key === dimension);
  if (!dimDef) return [];
  if (dimDef.values) return dimDef.values; // coded dims: fixed list
  const sql = dimensionValueSource(dimension);
  if (!sql || !fanniePool) return [];
  try {
    const r = await fanniePool.query(sql);
    return r.rows.map((x: any) => ({ code: String(x.v), label: String(x.v) }));
  } catch (err: any) {
    console.error('[viz] dimension values failed:', err?.message ?? err);
    return [];
  }
}

export type ChartRow = { category: string; value: number };

export type ChartSpec = {
  metricId: string;
  title: string;
  chartType: ChartType;
  kind: 'trend' | 'breakdown';
  categoryLabel: string;
  measureLabel: string;
  unit: string;
  description: string;
  /** Optional accent color (name or #hex); undefined uses the default palette. */
  color?: string;
  /** Optional fill opacity 0.1–1. */
  opacity?: number;
};

export async function runMortgageChart(
  spec: VizSpec,
): Promise<{ ok: true; chartSpec: ChartSpec; rows: ChartRow[] } | { ok: false; error: string }> {
  if (!fanniePool) return { ok: false, error: 'Mortgage data source is not configured (FANNIE_DATABASE_URL missing).' };

  const resolution = resolveSpec(spec);
  if (!resolution.ok) return { ok: false, error: resolution.error };

  const { metric, chartType, limit, topN, excludeCategories, includeCategories, sort } = resolution.resolved;

  // Filterable origination-book metrics build their SQL (with bound filter
  // params) dynamically; everything else is a static query with an optional
  // limit param. Both paths are read-only and never interpolate user values.
  const { text, params } = metric.build
    ? metric.build(resolution.resolved)
    : { text: metric.sql as string, params: metric.usesLimit ? [limit] : [] };

  // The Fannie compute can be cold (Neon suspends idle computes); the first
  // query may time out while it wakes. Retry once before giving up, and never
  // throw — return a graceful error the caller can surface instead of a 500.
  let result;
  try {
    result = await fanniePool.query(text, params);
  } catch (err: any) {
    try {
      result = await fanniePool.query(text, params);
    } catch (err2: any) {
      console.error('[viz] mortgage query failed:', err2?.message ?? err2);
      return { ok: false, error: 'The mortgage data source was slow to respond. Please try again in a moment.' };
    }
  }

  let rows: ChartRow[] = result.rows
    .filter((r: any) => r.category != null && r.value != null)
    .map((r: any) => ({ category: String(r.category), value: Number(r.value) }));

  // --- caller-requested reshaping (all post-query, no SQL) so RyAgent can adjust
  // a chart dynamically: drop buckets, keep only some, reorder, or cap to top-N. ---

  // Keep only categories matching a keyword ("just show 60-89 and 90+").
  if (includeCategories.length > 0) {
    const kept = rows.filter((r) => {
      const cat = r.category.toLowerCase();
      return includeCategories.some((term) => cat.includes(term));
    });
    if (kept.length === 0) {
      return {
        ok: false,
        error: `No categories matched ${includeCategories.map((t) => `"${t}"`).join(', ')}. Try a broader keyword.`,
      };
    }
    rows = kept;
  }

  // Drop categories matching a keyword (e.g. the dominant "current" bucket so the
  // smaller delinquency buckets are legible). Case-insensitive substring match, so
  // "current" removes "Loan is current (0-29 days past due)".
  if (excludeCategories.length > 0) {
    const kept = rows.filter((r) => {
      const cat = r.category.toLowerCase();
      return !excludeCategories.some((term) => cat.includes(term));
    });
    if (kept.length === 0) {
      return {
        ok: false,
        error: `Excluding ${excludeCategories.map((t) => `"${t}"`).join(', ')} would remove every category. Try excluding fewer buckets.`,
      };
    }
    rows = kept;
  }

  // Explicit sort by value (only when asked — otherwise preserve the metric's
  // natural order, e.g. chronological months or ordered delinquency buckets).
  if (sort) {
    rows = [...rows].sort((a, b) => (sort === 'asc' ? a.value - b.value : b.value - a.value));
  }

  // Top-N cap for breakdowns when the caller asked for one. If no explicit sort
  // was given, rank by value descending so "top N" means the largest N.
  if (typeof topN === 'number' && metric.kind === 'breakdown' && rows.length > topN) {
    const ranked = sort ? rows : [...rows].sort((a, b) => b.value - a.value);
    rows = ranked.slice(0, topN);
  }

  const chartSpec: ChartSpec = {
    metricId: metric.id,
    title: resolution.resolved.title ?? metric.label,
    chartType,
    kind: metric.kind,
    categoryLabel: metric.categoryLabel,
    measureLabel: metric.measureLabel,
    unit: metric.unit,
    description: metric.description,
    color: resolution.resolved.color,
    opacity: resolution.resolved.opacity,
  };
  return { ok: true, chartSpec, rows };
}
