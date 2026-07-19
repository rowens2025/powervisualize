-- One row per team per game (home and away legs unpivoted) — the grain most
-- team metrics build on. Runs for/against and the win flag are from that team's view.
-- View (not table) so the daily ingest + "Refresh now" flow straight through
-- to the dashboard without a dbt run; the data is tiny.
{{ config(materialized='view') }}
with g as (
  select * from {{ ref('stg_sports_games') }}
)
select
  event_id,
  season,
  game_date,
  home_abbr   as team_abbr,
  home_team   as team_name,
  away_abbr   as opponent_abbr,
  home_score  as runs_for,
  away_score  as runs_against,
  (home_score > away_score) as won,
  true        as is_home
from g
union all
select
  event_id,
  season,
  game_date,
  away_abbr,
  away_team,
  home_abbr,
  away_score,
  home_score,
  (away_score > home_score),
  false
from g
