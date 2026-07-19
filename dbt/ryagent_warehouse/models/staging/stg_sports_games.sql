-- Cleaned MLB games: completed regular-season games with valid scores, one row
-- per game. Excludes spring training (season_type 1) and the All-Star exhibition.
select
  event_id,
  league,
  season,
  game_date,
  game_datetime,
  home_team,
  home_abbr,
  home_score,
  away_team,
  away_abbr,
  away_score
from {{ source('sports', 'raw_sports_scores') }}
where completed = true
  and season_type = 2
  and home_score is not null
  and away_score is not null
  and home_team not ilike '%all-star%'
  and away_team not ilike '%all-star%'
