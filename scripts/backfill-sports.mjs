// One-time MLB backfill from ESPN into public.raw_sports_scores.
// Usage: node scripts/backfill-sports.mjs [START=2026-03-01] [END=today]
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const pick = (k) => {
  const l = env.split(/\r?\n/).find((x) => x.startsWith(k + '='));
  return l ? l.slice(k.length + 1).trim().replace(/^["']|["']$/g, '') : undefined;
};
const pool = new pg.Pool({ connectionString: pick('DATABASE_URL'), ssl: { rejectUnauthorized: false }, max: 3, connectionTimeoutMillis: 20000 });

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard';
const start = new Date((process.argv[2] || '2026-03-01') + 'T00:00:00Z');
const end = process.argv[3] ? new Date(process.argv[3] + 'T00:00:00Z') : new Date();

const toInt = (v) => { const n = parseInt(String(v ?? ''), 10); return Number.isFinite(n) ? n : null; };
const yyyymmdd = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

function parse(e) {
  const comp = e?.competitions?.[0];
  const cs = comp?.competitors ?? [];
  const home = cs.find((c) => c.homeAway === 'home');
  const away = cs.find((c) => c.homeAway === 'away');
  if (!e?.id || !e?.date || !home || !away) return null;
  const t = e?.status?.type ?? {};
  return [
    String(e.id), 'MLB', toInt(e?.season?.year) ?? toInt(String(e.date).slice(0, 4)), toInt(e?.season?.type),
    String(e.date).slice(0, 10), String(e.date),
    home.team?.displayName ?? null, home.team?.abbreviation ?? null, toInt(home.score),
    away.team?.displayName ?? null, away.team?.abbreviation ?? null, toInt(away.score),
    t.name ?? null, !!t.completed, new Date().toISOString(),
  ];
}

async function upsert(rows) {
  if (!rows.length) return;
  const vals = [];
  const params = [];
  rows.forEach((r, i) => {
    const b = i * 15;
    vals.push(`(${Array.from({ length: 15 }, (_, j) => `$${b + j + 1}`).join(',')})`);
    params.push(...r);
  });
  await pool.query(
    `insert into public.raw_sports_scores
       (event_id, league, season, season_type, game_date, game_datetime, home_team, home_abbr, home_score, away_team, away_abbr, away_score, status, completed, updated_at)
     values ${vals.join(',')}
     on conflict (event_id) do update set
       season_type=excluded.season_type, home_score=excluded.home_score, away_score=excluded.away_score,
       status=excluded.status, completed=excluded.completed, updated_at=excluded.updated_at`,
    params,
  );
}

await pool.query('ALTER TABLE public.raw_sports_scores ADD COLUMN IF NOT EXISTS season_type int');

let total = 0;
let days = 0;
for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
  try {
    const resp = await fetch(`${ESPN}?dates=${yyyymmdd(d)}`, { headers: { accept: 'application/json' } });
    if (!resp.ok) { console.log(yyyymmdd(d), 'HTTP', resp.status); continue; }
    const data = await resp.json();
    const rows = (data?.events ?? []).map(parse).filter(Boolean);
    if (rows.length) { await upsert(rows); total += rows.length; days += 1; }
  } catch (e) {
    console.log(yyyymmdd(d), 'err', e.message);
  }
}
const t = await pool.query('select count(*)::int n, min(game_date) lo, max(game_date) hi from public.raw_sports_scores');
console.log(`\nBackfill done: +${total} games across ${days} game-days.`);
console.log(`Table now: ${t.rows[0].n} rows, ${t.rows[0].lo?.toISOString?.().slice(0,10)} .. ${t.rows[0].hi?.toISOString?.().slice(0,10)}`);
await pool.end();
