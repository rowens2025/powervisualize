select
  project_id,
  skill_id,
  strength,
  proof_weight
from {{ source('raw', 'project_skills') }}
