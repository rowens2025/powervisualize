/**
 * Shared mortgage chart runner — used by both /api/visualize (the button flow)
 * and /api/chat (the agent's build_visualization tool). Read-only.
 */
import { fanniePool } from './fannieDb.js';
import { resolveSpec, type ChartType, type VizSpec } from './mortgageMetrics.js';

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
};

export async function runMortgageChart(
  spec: VizSpec,
): Promise<{ ok: true; chartSpec: ChartSpec; rows: ChartRow[] } | { ok: false; error: string }> {
  if (!fanniePool) return { ok: false, error: 'Mortgage data source is not configured (FANNIE_DATABASE_URL missing).' };

  const resolution = resolveSpec(spec);
  if (!resolution.ok) return { ok: false, error: resolution.error };

  const { metric, chartType, limit } = resolution.resolved;
  const params = metric.usesLimit ? [limit] : [];

  // The Fannie compute can be cold (Neon suspends idle computes); the first
  // query may time out while it wakes. Retry once before giving up, and never
  // throw — return a graceful error the caller can surface instead of a 500.
  let result;
  try {
    result = await fanniePool.query(metric.sql, params);
  } catch (err: any) {
    try {
      result = await fanniePool.query(metric.sql, params);
    } catch (err2: any) {
      console.error('[viz] mortgage query failed:', err2?.message ?? err2);
      return { ok: false, error: 'The mortgage data source was slow to respond. Please try again in a moment.' };
    }
  }

  const rows: ChartRow[] = result.rows
    .filter((r: any) => r.category != null && r.value != null)
    .map((r: any) => ({ category: String(r.category), value: Number(r.value) }));

  const chartSpec: ChartSpec = {
    metricId: metric.id,
    title: metric.label,
    chartType,
    kind: metric.kind,
    categoryLabel: metric.categoryLabel,
    measureLabel: metric.measureLabel,
    unit: metric.unit,
    description: metric.description,
  };
  return { ok: true, chartSpec, rows };
}
