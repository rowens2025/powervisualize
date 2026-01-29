select
  ps.project_id,
  ps.skill_id,
  ps.strength,
  ps.proof_weight,
  s.name as skill_name,
  s.confidence as skill_confidence
from {{ ref('stg_project_skills') }} ps
join {{ ref('stg_skills') }} s
  on s.skill_id = ps.skill_id
