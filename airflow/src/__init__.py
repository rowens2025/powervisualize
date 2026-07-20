# Task logic for the orchestrated MLB pipeline. Kept as plain, importable
# functions so they can be unit-run locally (incl. on Windows, where Airflow
# itself won't run) and wired into the Airflow DAG in dags/mlb_daily_pipeline.py.
