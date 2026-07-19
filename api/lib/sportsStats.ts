import { pool } from '../_db.js';
import { runSportsQuery } from './runSports.js';
import { getSportsMetric } from './sportsMetrics.js';

/**
 * Sports KPI/stat layer — turns an existing governed breakdown metric into a
 * single headline figure for the dashboard's KPI band. No new SQL: we run the
 * same governed query over all 30 teams, then read one row (the league leader,
 * or a named team plus its league rank). This is what makes the AI-built
 * dashboard read as a designed dashboard rather than a stack of charts.
 */

export type SportsStatSpec = {
  metric: string;
  season?: number;
  /** When set, spotlight this team (value + league rank) instead of the leader. */
  team?: string;
  /** Ranking direction — 'desc' (default) leads with the highest; 'asc' with the lowest. */
  sort?: 'asc' | 'desc';
  /** Optional caption override, e.g. "Best offense". */
  label?: string;
};

export type BuiltSportsStat = {
  statSpec: SportsStatSpec;
  /** Eyebrow caption, e.g. "Wins leader" or "NYY · Wins". */
  caption: string;
  /** The team the figure belongs to (team name). */
  entity: string;
  /** Raw numeric value (for downstream use). */
  value: number;
  /** Display-formatted value, e.g. "61", "+58", ".642". */
  formatted: string;
  /** Context line, e.g. "Leads MLB" or "#3 of 30". */
  sub: string;
  measureLabel: string;
  season?: number;
};

// Team name by code, cached — the KPI rows come back as team names, so we map a
// requested code (LAD) to its name to find that team's row and rank.
let teamNames: { map: Record<string, string>; at: number } | null = null;
async function teamNameByCode(code: string): Promise<string | null> {
  if (!teamNames || Date.now() - teamNames.at > 6 * 60 * 60 * 1000) {
    try {
      const r = await pool.query('select team_abbr, team_name from analytics.dim_team');
      const map: Record<string, string> = {};
      for (const row of r.rows) map[String(row.team_abbr).toUpperCase()] = String(row.team_name);
      teamNames = { map, at: Date.now() };
    } catch {
      return null;
    }
  }
  return teamNames.map[code.toUpperCase()] ?? null;
}

/** Format a KPI value the way each measure reads best. */
function formatStatValue(metricId: string, v: number): string {
  if (/pct/.test(metricId)) return v.toFixed(3).replace(/^0(?=\.)/, ''); // .642
  if (/run_diff/.test(metricId)) return (v > 0 ? '+' : '') + Math.round(v).toLocaleString();
  if (/per_game/.test(metricId)) return v.toFixed(2);
  return Math.round(v).toLocaleString();
}

/**
 * Build one KPI stat from a governed breakdown metric. Leader mode (no team) or
 * team-spotlight mode (value + rank). Trends aren't rankable, so they're rejected.
 */
export async function buildSportsStat(
  spec: SportsStatSpec,
): Promise<{ ok: true; stat: BuiltSportsStat } | { ok: false; error: string }> {
  const metric = getSportsMetric(spec.metric);
  if (!metric) return { ok: false, error: `Unknown metric "${spec.metric}".` };
  if (metric.kind !== 'breakdown') {
    return { ok: false, error: `Stat tiles need a standings/breakdown metric (e.g. wins_by_team), not "${spec.metric}".` };
  }

  // Full league, sorted, so we get both the leader and any team's rank.
  const out = await runSportsQuery({ metric: spec.metric, season: spec.season, sort: spec.sort ?? 'desc', limit: 30 });
  if (!out.ok) return out;
  const rows = out.rows;
  if (rows.length === 0) return { ok: false, error: 'No data for this stat yet.' };
  const measureLabel = out.chartSpec.measureLabel;

  if (spec.team) {
    const name = await teamNameByCode(spec.team);
    const idx = name ? rows.findIndex((r) => r.category === name) : -1;
    if (idx >= 0) {
      const row = rows[idx];
      return {
        ok: true,
        stat: {
          statSpec: spec,
          caption: spec.label?.trim() || `${spec.team.toUpperCase()} · ${measureLabel}`,
          entity: name as string,
          value: row.value,
          formatted: formatStatValue(metric.id, row.value),
          sub: `#${idx + 1} of ${rows.length}`,
          measureLabel,
          season: spec.season,
        },
      };
    }
    // Unknown/absent team → fall through to the league leader.
  }

  const leader = rows[0];
  return {
    ok: true,
    stat: {
      statSpec: spec,
      caption: spec.label?.trim() || `${measureLabel} leader`,
      entity: leader.category,
      value: leader.value,
      formatted: formatStatValue(metric.id, leader.value),
      sub: `#1 of ${rows.length}`,
      measureLabel,
      season: spec.season,
    },
  };
}
