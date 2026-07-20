"""Task 1 — extract MLB scores from ESPN's public scoreboard and upsert into
public.raw_sports_scores. Python port of api/sports-ingest.ts; idempotent via
upsert on event_id, so it composes safely with the Vercel cron path."""
from __future__ import annotations

import datetime as dt

import requests
import psycopg2
from psycopg2.extras import execute_values

from .config import get_conn_str

ESPN = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard"
LEAGUE = "MLB"
DEFAULT_DAYS = 3

CREATE_SQL = """
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
"""

UPSERT_SQL = """
insert into public.raw_sports_scores
  (event_id, league, season, season_type, game_date, game_datetime,
   home_team, home_abbr, home_score, away_team, away_abbr, away_score,
   status, completed, updated_at)
values %s
on conflict (event_id) do update set
  season_type = excluded.season_type,
  home_score  = excluded.home_score,
  away_score  = excluded.away_score,
  status      = excluded.status,
  completed   = excluded.completed,
  updated_at  = excluded.updated_at
"""


def _to_int(v):
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def parse_event(e: dict) -> dict | None:
    """Parse one ESPN scoreboard event into a row dict (None if malformed)."""
    try:
        comp = (e.get("competitions") or [{}])[0]
        competitors = comp.get("competitors") or []
        home = next((c for c in competitors if c.get("homeAway") == "home"), None)
        away = next((c for c in competitors if c.get("homeAway") == "away"), None)
        if not e.get("id") or not e.get("date") or not home or not away:
            return None
        tp = (e.get("status") or {}).get("type") or {}
        date = str(e["date"])
        season = e.get("season") or {}
        home_t = home.get("team") or {}
        away_t = away.get("team") or {}
        return {
            "event_id": str(e["id"]),
            "league": LEAGUE,
            "season": _to_int(season.get("year")) or _to_int(date[:4]),
            "season_type": _to_int(season.get("type")),
            "game_date": date[:10],
            "game_datetime": date,
            "home_team": home_t.get("displayName"),
            "home_abbr": home_t.get("abbreviation"),
            "home_score": _to_int(home.get("score")),
            "away_team": away_t.get("displayName"),
            "away_abbr": away_t.get("abbreviation"),
            "away_score": _to_int(away.get("score")),
            "status": tp.get("name"),
            "completed": bool(tp.get("completed")),
        }
    except Exception:
        return None


def _fetch_day(date_str: str) -> list[dict]:
    resp = requests.get(ESPN, params={"dates": date_str}, headers={"accept": "application/json"}, timeout=30)
    resp.raise_for_status()
    events = (resp.json() or {}).get("events") or []
    return [g for g in (parse_event(e) for e in events) if g]


def ingest(days: int = DEFAULT_DAYS, conn_str: str | None = None) -> dict:
    """Scan the last `days` days on ESPN and upsert into the raw layer."""
    conn_str = conn_str or get_conn_str()
    today = dt.datetime.now(dt.timezone.utc).date()

    rows: list[dict] = []
    days_with_games = 0
    for i in range(max(1, days)):
        d = today - dt.timedelta(days=i)
        day_rows = _fetch_day(d.strftime("%Y%m%d"))
        if day_rows:
            rows.extend(day_rows)
            days_with_games += 1

    conn = psycopg2.connect(conn_str)
    try:
        with conn, conn.cursor() as cur:
            cur.execute(CREATE_SQL)
            if rows:
                now = dt.datetime.now(dt.timezone.utc)
                values = [
                    (
                        r["event_id"], r["league"], r["season"], r["season_type"],
                        r["game_date"], r["game_datetime"], r["home_team"], r["home_abbr"],
                        r["home_score"], r["away_team"], r["away_abbr"], r["away_score"],
                        r["status"], r["completed"], now,
                    )
                    for r in rows
                ]
                execute_values(cur, UPSERT_SQL, values)
            cur.execute(
                "select count(*)::int, to_char(max(game_date), 'YYYY-MM-DD') "
                "from public.raw_sports_scores"
            )
            total, latest = cur.fetchone()
    finally:
        conn.close()

    return {
        "rows_ingested": len(rows),
        "days_scanned": max(1, days),
        "days_with_games": days_with_games,
        "table_total": total,
        "latest_game_date": latest,
    }
