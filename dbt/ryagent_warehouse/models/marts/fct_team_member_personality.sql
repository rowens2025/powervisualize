select
  team_member_id,
  personality_id
from {{ ref('stg_team_member_personality') }}
