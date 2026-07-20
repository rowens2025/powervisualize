"""Run the pipeline end-to-end WITHOUT Airflow.

Airflow doesn't run natively on Windows, so this executes the exact same task
functions in the same order the DAG wires them — a faithful local test of the
pipeline logic against the real Neon warehouse. The full Airflow DAG is exercised
in CI (Linux) via `airflow dags test`.

Usage:  python airflow/run_local.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.ingest_espn import ingest
from src.dbt_task import run_dbt
from src.quality import check_freshness
from src.publish import publish

SNAPSHOT = "mart_team_standings_snapshot"
TEST_SELECT = [SNAPSHOT, "mart_team_season", "dim_team"]


def main() -> int:
    print("-> [1/5] ingest_espn")
    ing = ingest(days=3)
    print("   ", ing)

    print("-> [2/5] dbt_build_snapshot")
    run_dbt("run", [SNAPSHOT])

    print("-> [3/5] dbt_test")
    test_res = run_dbt("test", TEST_SELECT)
    print("   ", test_res)

    print("-> [4/5] freshness_check")
    quality = check_freshness()
    print("   ", quality)

    print("-> [5/5] publish")
    record = publish(
        {**quality, "rows_ingested": ing["rows_ingested"]},
        dbt_tests_passed=test_res.get("passed"),
    )
    print("   ", record)

    print("\n[OK] pipeline complete - wrote public/pipeline/last_run.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
