-- Daily point-in-time MLB standings snapshot: one row per team per season per
-- snapshot_date (the pipeline run date).
--
-- This is the model the ORCHESTRATED pipeline owns. Unlike the live sports marts
-- (dim_team / fct_team_game / mart_team_season are views so the ingest + "Refresh
-- now" flow straight to the dashboard), this materializes as an INCREMENTAL TABLE
-- so each run does real transform work and appends one immutable dated batch — a
-- genuine dbt build + test step for Airflow to orchestrate, and the basis for
-- "standings over time".
--
-- Point-in-time integrity: snapshot_date is always the run date, so past batches
-- are never rewritten (late score corrections only affect today's capture).
{{ config(
    materialized='incremental',
    unique_key=['season', 'team_abbr', 'snapshot_date'],
    on_schema_change='append_new_columns'
) }}

select
  current_date                          as snapshot_date,
  s.season,
  s.team_abbr,
  s.team_name,
  s.games,
  s.wins,
  s.losses,
  s.win_pct,
  s.runs_for,
  s.runs_against,
  s.run_diff,
  s.runs_for_per_game,
  s.runs_against_per_game
from {{ ref('mart_team_season') }} s

{% if is_incremental() %}
-- Idempotent per day: never re-append a snapshot for a date already captured.
where current_date not in (select snapshot_date from {{ this }})
{% endif %}
