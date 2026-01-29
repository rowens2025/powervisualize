select
  skill_id,
  name,
  confidence,
  summary,
  aliases
from {{ source('raw', 'skills') }}
