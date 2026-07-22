import { pool } from '../_db.js';
import { resolveSportsQuery, resolveSportsCombo, resolveSportsDerived, SPORTS_DIMENSIONS, type SportsQuery, type SportsChartSpec } from './sportsMetrics.js';

export type SportsRow = { category: string; value: number; value2?: number };

/** Two breakdown metrics on one chart (bars + line). Reads mart_team_season once. */
export async function runSportsCombo(q: {
  metricA: string;
  metricB: string;
  season?: number;
  sort?: 'asc' | 'desc';
  limit?: number;
}): Promise<{ ok: true; chartSpec: SportsChartSpec; rows: SportsRow[] } | { ok: false; error: string }> {
  const resolved = resolveSportsCombo(q);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const { a, b, text, params } = resolved;

  let result;
  try {
    result = await pool.query(text, params);
  } catch (err: any) {
    console.error('[sports] combo query failed:', err?.message ?? err);
    return { ok: false, error: 'The sports data source was slow to respond. Please try again.' };
  }

  const rows: SportsRow[] = result.rows
    .filter((r: any) => r.category != null && r.value != null)
    .map((r: any) => ({ category: String(r.category), value: Number(r.value), value2: r.value2 != null ? Number(r.value2) : undefined }));

  const chartSpec: SportsChartSpec = {
    metricId: `${a.id}__${b.id}`,
    title: `${a.label} vs ${b.label}`,
    chartType: 'combo',
    kind: 'breakdown',
    categoryLabel: 'Team',
    measureLabel: a.measureLabel,
    unit: a.unit,
    description: `${a.measureLabel} (bars) and ${b.measureLabel} (line) by team, so you can compare both at once.`,
    secondaryMetricId: b.id,
    secondaryLabel: b.measureLabel,
    secondaryUnit: b.unit,
  };
  return { ok: true, chartSpec, rows };
}

/** Crunch two breakdown metrics into a new derived metric (single value per team). */
export async function runSportsDerived(q: {
  metricA: string;
  metricB: string;
  op: string;
  label?: string;
  season?: number;
  sort?: 'asc' | 'desc';
  limit?: number;
}): Promise<{ ok: true; chartSpec: SportsChartSpec; rows: SportsRow[] } | { ok: false; error: string }> {
  const resolved = resolveSportsDerived(q);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const { a, b, label, text, params } = resolved;

  let result;
  try {
    result = await pool.query(text, params);
  } catch (err: any) {
    console.error('[sports] derived query failed:', err?.message ?? err);
    return { ok: false, error: 'The sports data source was slow to respond. Please try again.' };
  }

  const rows: SportsRow[] = result.rows
    .filter((r: any) => r.category != null && r.value != null)
    .map((r: any) => ({ category: String(r.category), value: Number(r.value) }));

  const chartSpec: SportsChartSpec = {
    metricId: `${a.id}_${resolved.op}_${b.id}`,
    title: label,
    chartType: 'bar',
    kind: 'breakdown',
    categoryLabel: 'Team',
    measureLabel: label,
    unit: '',
    description: `Derived metric: ${a.measureLabel} ${resolved.op} ${b.measureLabel}, computed per team on the fly.`,
  };
  return { ok: true, chartSpec, rows };
}

/**
 * Execute one governed sports query against the MLB marts (portfolio Neon,
 * `analytics` schema). Read-only; the caller only selects a metric + filters.
 */
export async function runSportsQuery(
  q: SportsQuery,
): Promise<{ ok: true; chartSpec: SportsChartSpec; rows: SportsRow[] } | { ok: false; error: string }> {
  const resolution = resolveSportsQuery(q);
  if (!resolution.ok) return { ok: false, error: resolution.error };

  const { metric, chartType } = resolution.resolved;
  const { text, params } = metric.build(resolution.resolved);

  let result;
  try {
    result = await pool.query(text, params);
  } catch (err: any) {
    console.error('[sports] query failed:', err?.message ?? err);
    return { ok: false, error: 'The sports data source was slow to respond. Please try again.' };
  }

  const rows: SportsRow[] = result.rows
    .filter((r: any) => r.category != null && r.value != null)
    .map((r: any) => ({ category: String(r.category), value: Number(r.value) }));

  const chartSpec: SportsChartSpec = {
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

/** Warehouse freshness snapshot for the sports page header. */
export async function getSportsStatus(): Promise<{
  games: number;
  teamGames: number;
  latestGameDate: string | null;
  lastIngestedAt: string | null;
  seasons: number[];
}> {
  const [raw, fct, seasons] = await Promise.all([
    pool.query(`select count(*)::int as n, to_char(max(game_date), 'YYYY-MM-DD') as latest, to_char(max(updated_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated from public.raw_sports_scores`),
    pool.query('select count(*)::int as n from analytics.fct_team_game'),
    pool.query('select distinct season::int as season from analytics.mart_team_season order by season desc'),
  ]);
  return {
    games: raw.rows[0]?.n ?? 0,
    teamGames: fct.rows[0]?.n ?? 0,
    latestGameDate: raw.rows[0]?.latest ?? null,
    lastIngestedAt: raw.rows[0]?.updated ?? null,
    seasons: seasons.rows.map((r: any) => r.season),
  };
}

/** Selectable values for a sports dimension's dropdown. */
export async function listSportsDimensionValues(dimension: string): Promise<{ code: string; label: string }[]> {
  const def = SPORTS_DIMENSIONS[dimension as keyof typeof SPORTS_DIMENSIONS];
  if (!def) return [];
  try {
    const r = await pool.query(def.valuesSql);
    return r.rows.map((x: any) => ({ code: String(x.v), label: x.label != null ? String(x.label) : String(x.v) }));
  } catch (err: any) {
    console.error('[sports] dimension values failed:', err?.message ?? err);
    return [];
  }
}
