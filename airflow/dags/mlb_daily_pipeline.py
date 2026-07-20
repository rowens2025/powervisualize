"""mlb_daily_pipeline — the orchestrated MLB pipeline.

    ingest_espn → dbt_build_snapshot → dbt_test → freshness_check → publish

Extracts daily MLB scores from ESPN into the Neon raw layer, builds the
incremental standings snapshot with dbt, runs dbt tests as a quality gate,
asserts freshness, then publishes a run record + last_run.json.

Runs headless in CI via `airflow dags test mlb_daily_pipeline` (see
.github/workflows/mlb-airflow.yml) — no always-on scheduler required. The task
logic lives in ../src so it can also be run without Airflow (see run_local.py).
"""
from __future__ import annotations

import os
import sys

import pendulum

from airflow import DAG
from airflow.operators.python import PythonOperator

# Make the sibling `src` package importable (airflow/ on sys.path).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.ingest_espn import ingest  # noqa: E402
from src.dbt_task import run_dbt  # noqa: E402
from src.quality import check_freshness  # noqa: E402
from src.publish import publish  # noqa: E402

SNAPSHOT = "mart_team_standings_snapshot"
TEST_SELECT = [SNAPSHOT, "mart_team_season", "dim_team"]


def _ingest(**ctx):
    stats = ingest(days=3)
    ctx["ti"].xcom_push(key="ingest", value=stats)
    return stats


def _dbt_build(**_ctx):
    return run_dbt("run", [SNAPSHOT])


def _dbt_test(**ctx):
    res = run_dbt("test", TEST_SELECT)
    ctx["ti"].xcom_push(key="dbt_tests_passed", value=res.get("passed"))
    return res


def _freshness(**ctx):
    res = check_freshness()
    ctx["ti"].xcom_push(key="quality", value=res)
    return res


def _publish(**ctx):
    ti = ctx["ti"]
    quality = ti.xcom_pull(key="quality") or {}
    ingest_stats = ti.xcom_pull(key="ingest") or {}
    tests_passed = ti.xcom_pull(key="dbt_tests_passed")
    stats = {**quality, "rows_ingested": ingest_stats.get("rows_ingested")}
    return publish(stats, run_id=ctx["run_id"], dbt_tests_passed=tests_passed, status="success")


with DAG(
    dag_id="mlb_daily_pipeline",
    description="Daily ESPN → Neon → dbt snapshot → tests → publish",
    schedule="0 12 * * *",  # after the Vercel ingest at 11:00 UTC
    start_date=pendulum.datetime(2026, 7, 1, tz="UTC"),
    catchup=False,
    tags=["mlb", "dbt", "showcase"],
    default_args={"retries": 2, "retry_delay": pendulum.duration(minutes=2)},
) as dag:
    t_ingest = PythonOperator(task_id="ingest_espn", python_callable=_ingest)
    t_build = PythonOperator(task_id="dbt_build_snapshot", python_callable=_dbt_build)
    t_test = PythonOperator(task_id="dbt_test", python_callable=_dbt_test)
    t_fresh = PythonOperator(task_id="freshness_check", python_callable=_freshness)
    t_publish = PythonOperator(task_id="publish", python_callable=_publish)

    t_ingest >> t_build >> t_test >> t_fresh >> t_publish
