import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from './_db.js';

/**
 * Daily MLB ingest — lands game scores from ESPN's public scoreboard feed into
 * public.raw_sports_scores (the "raw" layer of the portfolio warehouse). dbt
 * models this into curated marts the sports dashboard reads.
 *
 * Runs two ways:
 *   - GET  (Vercel Cron, daily): refresh the last few days so late finals and
 *          score corrections are captured. Optionally guarded by CRON_SECRET.
 *   - POST (the "Refresh now" button): same, rate-limited per IP.
 *
 * Source: https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard
 * — free, no key, near-live. We evaluated TheSportsDB (preferred) but its free
 * tier now returns only a single event, so ESPN is the agile free choice.
 */

const LEAGUE = 'MLB';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard';
const DEFAULT_DAYS = 3;
const MAX_DAYS = 21; // manual refresh cap; the backfill script handles full seasons

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS public.raw_sports_scores (
  event_id      text PRIMARY KEY,
  league        text NOT NULL,
  season        int,
  season_type   int,
  game_date     date NOT NULL,
  game_datetime timestamptz,
  home_team     text,
  home_abbr     text,
  home_score    int,
  away_team     text,
  away_abbr     text,
  away_score    int,
  status        text,
  completed     boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raw_sports_scores ADD COLUMN IF NOT EXISTS season_type int;
CREATE INDEX IF NOT EXISTS raw_sports_scores_date_idx ON public.raw_sports_scores (game_date);
`;

export type GameRow = {
  eventId: string;
  league: string;
  season: number | null;
  seasonType: number | null;
  gameDate: string;
  gameDatetime: string | null;
  homeTeam: string | null;
  homeAbbr: string | null;
  homeScore: number | null;
  awayTeam: string | null;
  awayAbbr: string | null;
  awayScore: number | null;
  status: string | null;
  completed: boolean;
};

function toInt(v: unknown): number | null {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** Parse one ESPN scoreboard event into a GameRow (null if malformed). */
export function parseEspnEvent(e: any): GameRow | null {
  try {
    const comp = e?.competitions?.[0];
    const competitors = comp?.competitors ?? [];
    const home = competitors.find((c: any) => c.homeAway === 'home');
    const away = competitors.find((c: any) => c.homeAway === 'away');
    if (!e?.id || !e?.date || !home || !away) return null;
    const type = e?.status?.type ?? {};
    return {
      eventId: String(e.id),
      league: LEAGUE,
      season: toInt(e?.season?.year) ?? toInt(String(e.date).slice(0, 4)),
      seasonType: toInt(e?.season?.type),
      gameDate: String(e.date).slice(0, 10),
      gameDatetime: String(e.date),
      homeTeam: home.team?.displayName ?? null,
      homeAbbr: home.team?.abbreviation ?? null,
      homeScore: toInt(home.score),
      awayTeam: away.team?.displayName ?? null,
      awayAbbr: away.team?.abbreviation ?? null,
      awayScore: toInt(away.score),
      status: type.name ?? null,
      completed: !!type.completed,
    };
  } catch {
    return null;
  }
}

function yyyymmdd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function fetchDay(dateStr: string): Promise<GameRow[]> {
  const resp = await fetch(`${ESPN}?dates=${dateStr}`, { headers: { accept: 'application/json' } });
  if (!resp.ok) throw new Error(`ESPN ${resp.status} for ${dateStr}`);
  const data: any = await resp.json();
  return (data?.events ?? []).map(parseEspnEvent).filter((g: GameRow | null): g is GameRow => g !== null);
}

export async function upsertGames(rows: GameRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const values: string[] = [];
  const params: unknown[] = [];
  rows.forEach((r, i) => {
    const b = i * 15;
    values.push(`(${Array.from({ length: 15 }, (_, j) => `$${b + j + 1}`).join(',')})`);
    params.push(r.eventId, r.league, r.season, r.seasonType, r.gameDate, r.gameDatetime, r.homeTeam, r.homeAbbr, r.homeScore, r.awayTeam, r.awayAbbr, r.awayScore, r.status, r.completed, new Date().toISOString());
  });
  await pool.query(
    `insert into public.raw_sports_scores
       (event_id, league, season, season_type, game_date, game_datetime, home_team, home_abbr, home_score, away_team, away_abbr, away_score, status, completed, updated_at)
     values ${values.join(',')}
     on conflict (event_id) do update set
       season_type = excluded.season_type,
       home_score  = excluded.home_score,
       away_score  = excluded.away_score,
       status      = excluded.status,
       completed   = excluded.completed,
       updated_at  = excluded.updated_at`,
    params,
  );
  return rows.length;
}

// Per-process IP rate limit for the manual "Refresh now" button.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 4;
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

export type IngestResult = {
  ok: true;
  league: string;
  daysScanned: number;
  daysWithGames: number;
  gamesUpserted: number;
  tableTotal: number;
  latestGameDate: string | null;
};

/**
 * Run one ingest pass: scan the last `days` days on ESPN and upsert into the
 * raw layer. Shared by the cron GET, the "Refresh now" POST, and the sports
 * RyAgent's refresh_data tool.
 */
export async function runSportsIngest(daysRequested?: number): Promise<IngestResult> {
  const days = Number.isFinite(daysRequested) ? Math.max(1, Math.min(MAX_DAYS, Math.round(daysRequested as number))) : DEFAULT_DAYS;
  await pool.query(CREATE_SQL);

  const today = new Date();
  let ingested = 0;
  let daysWithGames = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    let rows: GameRow[] = [];
    try {
      rows = await fetchDay(yyyymmdd(d));
    } catch (err: any) {
      console.error('[sports-ingest] fetch failed:', err?.message ?? err);
      continue;
    }
    if (rows.length > 0) {
      await upsertGames(rows);
      ingested += rows.length;
      daysWithGames += 1;
    }
  }

  const total = await pool.query('select count(*)::int as n, to_char(max(game_date), \'YYYY-MM-DD\') as latest from public.raw_sports_scores');
  return {
    ok: true,
    league: LEAGUE,
    daysScanned: days,
    daysWithGames,
    gamesUpserted: ingested,
    tableTotal: total.rows[0]?.n ?? 0,
    latestGameDate: total.rows[0]?.latest ?? null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET (cron) or POST (refresh).' });
  }

  // Cron guard: if CRON_SECRET is set, GET must carry it (Vercel Cron sends it).
  if (req.method === 'GET' && process.env.CRON_SECRET) {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  if (req.method === 'POST' && rateLimited(req)) {
    return res.status(429).json({ error: 'Please wait a moment before refreshing again.' });
  }

  const requested = req.method === 'POST' ? Number(req.body?.days) : Number(req.query?.days);

  try {
    return res.status(200).json(await runSportsIngest(requested));
  } catch (err: any) {
    console.error('[sports-ingest] error:', err?.message ?? err);
    return res.status(500).json({ error: 'Sports ingest failed.' });
  }
}
