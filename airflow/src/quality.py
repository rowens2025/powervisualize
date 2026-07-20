"""Task 4 — data-quality gate. Asserts the warehouse is populated and that
today's snapshot actually landed. Raises AssertionError (fails the task) on
failure so a bad run never gets published as healthy."""
from __future__ import annotations

import psycopg2

from .config import get_conn_str


def check_freshness(conn_str: str | None = None) -> dict:
    conn_str = conn_str or get_conn_str()
    conn = psycopg2.connect(conn_str)
    try:
        with conn.cursor() as cur:
            # Anchor "today" to the database clock (UTC) so it matches the
            # snapshot's current_date regardless of where this task runs.
            cur.execute("select current_date")
            (today,) = cur.fetchone()
            cur.execute("select count(*)::int, max(game_date) from public.raw_sports_scores")
            games, latest = cur.fetchone()
            cur.execute("select count(*)::int from analytics.fct_team_game")
            (team_games,) = cur.fetchone()
            cur.execute(
                "select count(*)::int, max(snapshot_date) "
                "from analytics.mart_team_standings_snapshot"
            )
            snap_rows, snap_date = cur.fetchone()
    finally:
        conn.close()

    assert games > 0, "raw_sports_scores is empty"
    assert team_games > 0, "fct_team_game is empty"
    assert snap_rows > 0, "standings snapshot is empty"
    assert snap_date == today, f"snapshot_date {snap_date} is not today ({today}) - dbt build did not run"

    # Reported (not asserted): off-days/off-season legitimately widen this.
    latest_age_days = (today - latest).days if latest else None

    return {
        "games": games,
        "team_games": team_games,
        "snapshot_rows": snap_rows,
        "snapshot_date": str(snap_date),
        "latest_game_date": str(latest) if latest else None,
        "latest_age_days": latest_age_days,
    }
