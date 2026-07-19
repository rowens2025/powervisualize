-- Season-to-date team standings and run totals. One row per team per season.
-- View (not table) so the daily ingest + "Refresh now" flow straight through
-- to the dashboard without a dbt run; the data is tiny.
{{ config(materialized='view') }}
select
  g.team_abbr,
  t.team_name,
  g.season,
  count(*)                                              as games,
  sum(case when g.won then 1 else 0 end)                as wins,
  sum(case when not g.won then 1 else 0 end)            as losses,
  round(avg(case when g.won then 1.0 else 0.0 end), 3)  as win_pct,
  sum(g.runs_for)                                       as runs_for,
  sum(g.runs_against)                                   as runs_against,
  sum(g.runs_for - g.runs_against)                      as run_diff,
  round(avg(g.runs_for), 2)                             as runs_for_per_game,
  round(avg(g.runs_against), 2)                         as runs_against_per_game
from {{ ref('fct_team_game') }} g
left join {{ ref('dim_team') }} t on t.team_abbr = g.team_abbr
group by g.team_abbr, t.team_name, g.season
