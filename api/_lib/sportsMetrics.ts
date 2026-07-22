/**
 * Sports semantic layer — a Cube.js-style governed metric catalog over the MLB
 * marts (schema `analytics`, portfolio Neon DB). It is deliberately self-
 * describing: /api/sports/meta serializes this catalog into plain-English docs an
 * AI (or a human via Swagger/Scalar) can read to learn how to query, and
 * /api/sports/query executes one governed query. The caller only ever picks a
 * metricId + whitelisted dimensions/filters — never raw SQL.
 */

export const SPORTS_CHART_TYPES = ['bar', 'horizontalBar', 'line', 'area', 'pie'] as const;
export type SportsChartType = (typeof SPORTS_CHART_TYPES)[number];
export type SportsKind = 'breakdown' | 'trend';

const S = 'analytics';

export type SportsDimension = 'season' | 'team';

export const SPORTS_DIMENSIONS: Record<SportsDimension, { label: string; description: string; numeric: boolean; valuesSql: string }> = {
  season: {
    label: 'Season',
    description: 'MLB season year. Defaults to the latest season when omitted.',
    numeric: true,
    valuesSql: `select distinct season::int as v from ${S}.mart_team_season order by v desc`,
  },
  team: {
    label: 'Team',
    description: 'A team, by 2–3 letter code (e.g. LAD, NYY). Used to filter a metric to one club or drive a per-team trend.',
    numeric: false,
    valuesSql: `select team_abbr as v, team_name as label from ${S}.dim_team order by team_abbr`,
  },
};

export type SportsMetric = {
  id: string;
  label: string;
  description: string;
  kind: SportsKind;
  categoryLabel: string;
  measureLabel: string;
  unit: string;
  chartTypes: SportsChartType[];
  defaultChart: SportsChartType;
  /** Dimensions this metric can be filtered/split by. */
  dimensions: SportsDimension[];
  /** Whether `team` is required (per-team trends). */
  requiresTeam?: boolean;
  /** Raw measure SQL over mart_team_season (breakdown metrics only) — enables combining two metrics into one chart. */
  measureExpr?: string;
  example: string;
  build: (q: ResolvedSportsQuery) => { text: string; params: unknown[] };
};

/** A team-standings breakdown over mart_team_season, filterable by season (+ optional team). */
function standingBreakdown(cfg: {
  id: string;
  label: string;
  description: string;
  measureLabel: string;
  unit: string;
  measureExpr: string;
  chartTypes?: SportsChartType[];
  defaultChart?: SportsChartType;
  example: string;
}): SportsMetric {
  return {
    id: cfg.id,
    label: cfg.label,
    description: cfg.description,
    kind: 'breakdown',
    categoryLabel: 'Team',
    measureLabel: cfg.measureLabel,
    unit: cfg.unit,
    chartTypes: cfg.chartTypes ?? ['bar', 'horizontalBar'],
    defaultChart: cfg.defaultChart ?? 'bar',
    dimensions: ['season', 'team'],
    measureExpr: cfg.measureExpr,
    example: cfg.example,
    build: (q) => {
      const params: unknown[] = [];
      const wheres: string[] = [];
      if (typeof q.season === 'number') {
        params.push(q.season);
        wheres.push(`season = $${params.length}`);
      } else {
        wheres.push(`season = (select max(season) from ${S}.mart_team_season)`);
      }
      if (q.team) {
        params.push(q.team);
        wheres.push(`team_abbr = $${params.length}`);
      }
      params.push(q.limit);
      const text =
        `select team_name as category, ${cfg.measureExpr} as value ` +
        `from ${S}.mart_team_season where ${wheres.join(' and ')} ` +
        `order by value ${q.sort === 'asc' ? 'asc' : 'desc'} limit $${params.length}`;
      return { text, params };
    },
  };
}

export const SPORTS_METRICS: SportsMetric[] = [
  standingBreakdown({
    id: 'wins_by_team',
    label: 'Wins by team',
    description: 'Total regular-season wins per team. The core standings metric.',
    measureLabel: 'Wins',
    unit: '',
    measureExpr: 'wins',
    example: 'Which teams have the most wins?',
  }),
  standingBreakdown({
    id: 'win_pct_by_team',
    label: 'Win percentage by team',
    description: 'Share of games won per team (0–1), the fairest standings comparison.',
    measureLabel: 'Win %',
    unit: '',
    measureExpr: 'round(win_pct, 3)',
    example: 'Rank teams by win percentage',
  }),
  standingBreakdown({
    id: 'run_diff_by_team',
    label: 'Run differential by team',
    description: 'Runs scored minus runs allowed per team — a strong signal of true team strength.',
    measureLabel: 'Run differential',
    unit: '',
    measureExpr: 'run_diff',
    chartTypes: ['bar', 'horizontalBar'],
    example: 'Which teams have the best run differential?',
  }),
  standingBreakdown({
    id: 'runs_scored_by_team',
    label: 'Runs scored by team',
    description: 'Total runs scored per team this season (offense).',
    measureLabel: 'Runs scored',
    unit: '',
    measureExpr: 'runs_for',
    example: 'Which offenses have scored the most runs?',
  }),
  standingBreakdown({
    id: 'runs_allowed_by_team',
    label: 'Runs allowed by team',
    description: 'Total runs allowed per team this season (pitching/defense).',
    measureLabel: 'Runs allowed',
    unit: '',
    measureExpr: 'runs_against',
    example: 'Which teams have allowed the fewest runs?',
  }),
  standingBreakdown({
    id: 'runs_per_game_by_team',
    label: 'Runs per game by team',
    description: 'Average runs scored per game per team.',
    measureLabel: 'Runs/game',
    unit: '',
    measureExpr: 'runs_for_per_game',
    example: 'Average runs per game by team',
  }),
  standingBreakdown({
    id: 'pythag_win_pct_by_team',
    label: 'Pythagorean win % by team',
    description:
      "Expected win % from runs scored & allowed (Bill James' Pythagorean expectation: RS² / (RS² + RA²)). Compare it to actual win % to spot teams over- or under-performing their run differential — a classic sanity check on the standings.",
    measureLabel: 'Pythagorean win %',
    unit: '',
    measureExpr: 'round((power(runs_for, 2) / nullif(power(runs_for, 2) + power(runs_against, 2), 0))::numeric, 3)',
    example: "Chart Pythagorean win % vs actual win % — who's lucky or unlucky?",
  }),
  {
    id: 'team_cumulative_wins',
    label: 'Cumulative wins over the season (one team)',
    description: 'A single team’s running win total by game date. Requires a team filter.',
    kind: 'trend',
    categoryLabel: 'Date',
    measureLabel: 'Cumulative wins',
    unit: '',
    chartTypes: ['line', 'area', 'bar'],
    defaultChart: 'line',
    dimensions: ['season', 'team'],
    requiresTeam: true,
    example: 'Show the Dodgers’ cumulative wins over the season',
    build: (q) => {
      const params: unknown[] = [q.team];
      let seasonPred = `season = (select max(season) from ${S}.fct_team_game)`;
      if (typeof q.season === 'number') {
        params.push(q.season);
        seasonPred = `season = $${params.length}`;
      }
      const text =
        `select to_char(game_date, 'YYYY-MM-DD') as category, ` +
        `sum(case when won then 1 else 0 end) over (order by game_date rows between unbounded preceding and current row)::float as value ` +
        `from ${S}.fct_team_game where team_abbr = $1 and ${seasonPred} order by game_date`;
      return { text, params };
    },
  },
];

const BY_ID = new Map(SPORTS_METRICS.map((m) => [m.id, m]));
export function getSportsMetric(id: string): SportsMetric | undefined {
  return BY_ID.get(id);
}

export type SportsChartSpec = {
  metricId: string;
  title: string;
  chartType: SportsChartType | 'combo';
  kind: SportsKind;
  categoryLabel: string;
  measureLabel: string;
  unit: string;
  description: string;
  /** Combo charts (two metrics on one chart) carry the secondary (line) metric here. */
  secondaryMetricId?: string;
  secondaryLabel?: string;
  secondaryUnit?: string;
};

/** Resolve + validate two breakdown metrics for a combo chart, and build one query. */
export function resolveSportsCombo(q: {
  metricA: string;
  metricB: string;
  season?: number;
  sort?: 'asc' | 'desc';
  limit?: number;
}): { ok: true; a: SportsMetric; b: SportsMetric; text: string; params: unknown[] } | { ok: false; error: string } {
  const a = getSportsMetric(q.metricA);
  const b = getSportsMetric(q.metricB);
  if (!a || !b) return { ok: false, error: `Unknown metric in combo. Valid: ${SPORTS_METRICS.filter((m) => m.measureExpr).map((m) => m.id).join(', ')}.` };
  if (!a.measureExpr || !b.measureExpr) {
    return { ok: false, error: `A combo chart needs two standings (breakdown) metrics — trends like ${a.measureExpr ? b.id : a.id} can't be combined.` };
  }
  if (a.id === b.id) return { ok: false, error: 'A combo chart needs two DIFFERENT metrics.' };
  const season = typeof q.season === 'number' && Number.isFinite(q.season) ? Math.round(q.season) : undefined;
  let limit = typeof q.limit === 'number' && Number.isFinite(q.limit) ? Math.round(q.limit) : DEFAULT_LIMIT;
  limit = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
  const params: unknown[] = [];
  const wheres: string[] = [];
  if (typeof season === 'number') {
    params.push(season);
    wheres.push(`season = $${params.length}`);
  } else {
    wheres.push(`season = (select max(season) from ${S}.mart_team_season)`);
  }
  params.push(limit);
  const text =
    `select team_name as category, ${a.measureExpr} as value, ${b.measureExpr} as value2 ` +
    `from ${S}.mart_team_season where ${wheres.join(' and ')} ` +
    `order by value ${q.sort === 'asc' ? 'asc' : 'desc'} limit $${params.length}`;
  return { ok: true, a, b, text, params };
}

/**
 * On-the-fly derived metric: crunch two governed breakdown measures into a brand
 * new one the catalog doesn't ship (e.g. runs scored per win). The AI only picks
 * two metric ids + a whitelisted operator — the SQL is still ours, so it stays
 * governed and injection-proof.
 */
export type SportsDeriveOp = 'ratio' | 'difference' | 'sum' | 'product';
const DERIVE_OPS: Record<SportsDeriveOp, { verb: string; expr: (a: string, b: string) => string; round: boolean }> = {
  ratio: { verb: 'per', expr: (a, b) => `(${a})::numeric / nullif((${b}), 0)`, round: true },
  difference: { verb: 'minus', expr: (a, b) => `(${a}) - (${b})`, round: false },
  sum: { verb: 'plus', expr: (a, b) => `(${a}) + (${b})`, round: false },
  product: { verb: 'times', expr: (a, b) => `(${a}) * (${b})`, round: false },
};

export function resolveSportsDerived(q: {
  metricA: string;
  metricB: string;
  op: string;
  label?: string;
  season?: number;
  sort?: 'asc' | 'desc';
  limit?: number;
}):
  | { ok: true; a: SportsMetric; b: SportsMetric; op: SportsDeriveOp; label: string; text: string; params: unknown[] }
  | { ok: false; error: string } {
  const a = getSportsMetric(q.metricA);
  const b = getSportsMetric(q.metricB);
  const breakdowns = SPORTS_METRICS.filter((m) => m.measureExpr).map((m) => m.id).join(', ');
  if (!a || !b) return { ok: false, error: `Unknown metric in derive. Valid: ${breakdowns}.` };
  if (!a.measureExpr || !b.measureExpr) {
    return { ok: false, error: 'Deriving a metric needs two standings (breakdown) metrics — season trends can\'t be crunched together.' };
  }
  if (a.id === b.id) return { ok: false, error: 'Deriving a metric needs two DIFFERENT metrics.' };
  const op = DERIVE_OPS[q.op as SportsDeriveOp] ? (q.op as SportsDeriveOp) : undefined;
  if (!op) return { ok: false, error: `Unknown operator "${q.op}". Valid: ${Object.keys(DERIVE_OPS).join(', ')}.` };
  const def = DERIVE_OPS[op];
  const label = (q.label && q.label.trim().slice(0, 60)) || `${a.measureLabel} ${def.verb} ${b.measureLabel}`;

  const season = typeof q.season === 'number' && Number.isFinite(q.season) ? Math.round(q.season) : undefined;
  let limit = typeof q.limit === 'number' && Number.isFinite(q.limit) ? Math.round(q.limit) : DEFAULT_LIMIT;
  limit = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));

  const raw = def.expr(a.measureExpr, b.measureExpr);
  const measure = def.round ? `round((${raw})::numeric, 3)` : raw;
  const params: unknown[] = [];
  const wheres: string[] = [];
  if (typeof season === 'number') {
    params.push(season);
    wheres.push(`season = $${params.length}`);
  } else {
    wheres.push(`season = (select max(season) from ${S}.mart_team_season)`);
  }
  params.push(limit);
  const text =
    `select team_name as category, ${measure} as value ` +
    `from ${S}.mart_team_season where ${wheres.join(' and ')} ` +
    `order by value ${q.sort === 'asc' ? 'asc' : 'desc'} limit $${params.length}`;
  return { ok: true, a, b, op, label, text, params };
}

export type SportsQuery = {
  metric: string;
  season?: number;
  team?: string;
  sort?: 'asc' | 'desc';
  limit?: number;
  chartType?: SportsChartType;
};
export type ResolvedSportsQuery = {
  metric: SportsMetric;
  season?: number;
  team?: string;
  sort?: 'asc' | 'desc';
  limit: number;
  chartType: SportsChartType;
};

const DEFAULT_LIMIT = 10;
const MIN_LIMIT = 3;
const MAX_LIMIT = 30;

export function resolveSportsQuery(q: SportsQuery): { ok: true; resolved: ResolvedSportsQuery } | { ok: false; error: string } {
  const metric = getSportsMetric(q.metric);
  if (!metric) {
    return { ok: false, error: `Unknown metric "${q.metric}". Valid: ${SPORTS_METRICS.map((m) => m.id).join(', ')}.` };
  }
  const chartType = q.chartType && metric.chartTypes.includes(q.chartType) ? q.chartType : metric.defaultChart;
  const season = typeof q.season === 'number' && Number.isFinite(q.season) ? Math.round(q.season) : undefined;
  const team = typeof q.team === 'string' && /^[A-Za-z]{2,3}$/.test(q.team.trim()) ? q.team.trim().toUpperCase() : undefined;
  if (metric.requiresTeam && !team) {
    return { ok: false, error: `Metric "${metric.id}" needs a team (a 2–3 letter code like LAD). Add {"team":"LAD"}.` };
  }
  const sort = q.sort === 'asc' || q.sort === 'desc' ? q.sort : undefined;
  let limit = typeof q.limit === 'number' && Number.isFinite(q.limit) ? Math.round(q.limit) : DEFAULT_LIMIT;
  limit = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
  return { ok: true, resolved: { metric, season, team, sort, limit, chartType } };
}

/** Serialize the semantic layer for the meta endpoint (plain-English, AI-readable). */
export function describeSportsLayer() {
  return {
    dataset: 'MLB team performance (daily scores from ESPN, modeled with dbt into season marts).',
    grain: 'One row per team per season (standings) and one row per team per game (trends).',
    metrics: SPORTS_METRICS.map((m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      kind: m.kind,
      measure: m.measureLabel,
      unit: m.unit || 'count',
      dimensions: m.dimensions,
      requiresTeam: !!m.requiresTeam,
      chartTypes: m.chartTypes,
      defaultChart: m.defaultChart,
      example: m.example,
    })),
    dimensions: (Object.entries(SPORTS_DIMENSIONS) as [SportsDimension, (typeof SPORTS_DIMENSIONS)[SportsDimension]][]).map(([key, d]) => ({
      key,
      label: d.label,
      description: d.description,
      numeric: d.numeric,
    })),
    queryFormat: {
      endpoint: 'POST /api/sports/query',
      body: { metric: '<metricId>', season: '<year, optional>', team: '<2-3 letter code, optional>', sort: 'asc|desc (optional)', limit: '3-30 (optional)', chartType: '<one the metric allows, optional>' },
      notes: 'Only metric is required. season defaults to the latest. team filters to one club (required for team_cumulative_wins). The response is { chartSpec, rows: [{category, value}] }.',
      example: { metric: 'run_diff_by_team', limit: 8, sort: 'desc' },
    },
  };
}
