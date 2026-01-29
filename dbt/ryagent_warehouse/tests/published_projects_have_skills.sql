select
  p.project_id
from {{ ref('dim_projects') }} p
left join {{ ref('fct_project_skills') }} ps
  on ps.project_id = p.project_id
where p.status = 'published'
group by p.project_id
having count(ps.skill_id) = 0
