select
  team_member_id,
  personality_id
from {{ source('raw', 'team_member_personality') }}
