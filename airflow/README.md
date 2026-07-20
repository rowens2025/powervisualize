# Orchestrated MLB Pipeline (Airflow + dbt)

A real Airflow DAG that orchestrates the daily MLB data pipeline end to end:

```
ingest_espn → dbt_build_snapshot → dbt_test → freshness_check → publish
```

| Task | What it does |
|------|--------------|
| `ingest_espn` | Pull the last 3 days from ESPN's public scoreboard → upsert `public.raw_sports_scores` (idempotent) |
| `dbt_build_snapshot` | `dbt run` the incremental `mart_team_standings_snapshot` table |
| `dbt_test` | `dbt test` the snapshot + sports marts — the **quality gate** (failure stops the run) |
| `freshness_check` | Assert the warehouse is populated and today's snapshot landed |
| `publish` | Write a `public.pipeline_runs` record + `public/pipeline/last_run.json` (proof-of-run) |

## How it runs — serverless, $0

There is **no always-on Airflow server**. The DAG is executed once per day by GitHub
Actions via `airflow dags test mlb_daily_pipeline` (Linux), which runs a full DAG
run in-process — no scheduler, webserver, or metadata DB to host. See
`.github/workflows/mlb-airflow.yml` (Phase 3).

## Layout

```
airflow/
  dags/mlb_daily_pipeline.py   # the DAG (thin wiring)
  src/                         # task logic as plain, importable functions
    ingest_espn.py             # extract + load  (port of api/sports-ingest.ts)
    dbt_task.py                # dbt run / dbt test runner
    quality.py                 # freshness / row-count gate
    publish.py                 # heartbeat row + last_run.json
    config.py                  # conn string + dbt dirs
  run_local.py                 # run the pipeline WITHOUT Airflow (Windows-friendly)
  requirements.txt
```

## Local testing

Airflow doesn't run natively on Windows, so `run_local.py` executes the same task
functions in the same order for a faithful local test against Neon:

```bash
pip install requests psycopg2-binary   # dbt already installed
python airflow/run_local.py            # reads DATABASE_URL from env or .env.local
```

The full Airflow DAG (`airflow dags test`) runs in CI on Linux.
