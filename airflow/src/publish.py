"""Task 5 — publish. Writes a durable run record to public.pipeline_runs AND
emits public/pipeline/last_run.json (committed by CI) for the portfolio's live
"last run" card. This is the pipeline's publish step and its proof-of-run."""
from __future__ import annotations

import json
import datetime as dt

import psycopg2

from .config import get_conn_str, REPO_ROOT

PIPELINE_RUNS_SQL = """
CREATE TABLE IF NOT EXISTS public.pipeline_runs (
  run_id            text PRIMARY KEY,
  dag_id            text NOT NULL,
  status            text NOT NULL,
  started_at        timestamptz,
  finished_at       timestamptz NOT NULL DEFAULT now(),
  rows_ingested     int,
  snapshot_rows     int,
  dbt_tests_passed  int,
  latest_game_date  date,
  games_in_warehouse int,
  note              text
);
"""

INSERT_SQL = """
insert into public.pipeline_runs
  (run_id, dag_id, status, started_at, finished_at, rows_ingested,
   snapshot_rows, dbt_tests_passed, latest_game_date, games_in_warehouse, note)
values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
on conflict (run_id) do update set
  status = excluded.status,
  finished_at = excluded.finished_at,
  rows_ingested = excluded.rows_ingested,
  snapshot_rows = excluded.snapshot_rows,
  dbt_tests_passed = excluded.dbt_tests_passed,
  latest_game_date = excluded.latest_game_date,
  games_in_warehouse = excluded.games_in_warehouse,
  note = excluded.note
"""


def publish(
    stats: dict,
    run_id: str | None = None,
    dag_id: str = "mlb_daily_pipeline",
    status: str = "success",
    started_at=None,
    dbt_tests_passed: int | None = None,
    note: str | None = None,
    conn_str: str | None = None,
    out_path=None,
) -> dict:
    conn_str = conn_str or get_conn_str()
    now = dt.datetime.now(dt.timezone.utc)
    run_id = run_id or now.strftime("manual__%Y%m%dT%H%M%SZ")

    record = {
        "run_id": run_id,
        "dag_id": dag_id,
        "status": status,
        "finished_at": now.isoformat().replace("+00:00", "Z"),
        "rows_ingested": stats.get("rows_ingested"),
        "snapshot_rows": stats.get("snapshot_rows"),
        "snapshot_date": stats.get("snapshot_date"),
        "dbt_tests_passed": dbt_tests_passed,
        "latest_game_date": stats.get("latest_game_date"),
        "games_in_warehouse": stats.get("games"),
    }

    conn = psycopg2.connect(conn_str)
    try:
        with conn, conn.cursor() as cur:
            cur.execute(PIPELINE_RUNS_SQL)
            cur.execute(
                INSERT_SQL,
                (
                    run_id, dag_id, status, started_at, now,
                    record["rows_ingested"], record["snapshot_rows"], dbt_tests_passed,
                    record["latest_game_date"], record["games_in_warehouse"], note,
                ),
            )
    finally:
        conn.close()

    out = out_path or (REPO_ROOT / "public" / "pipeline" / "last_run.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")

    return record
