-- Dimension of MLB teams seen in the schedule (home or away).
-- View (not table) so the daily ingest + "Refresh now" flow straight through
-- to the dashboard without a dbt run; the data is tiny.
{{ config(materialized='view') }}
with teams as (
  select home_abbr as team_abbr, home_team as team_name from {{ ref('stg_sports_games') }}
  union
  select away_abbr, away_team from {{ ref('stg_sports_games') }}
)
select
  team_abbr,
  max(team_name) as team_name
from teams
where team_abbr is not null
group by team_abbr
