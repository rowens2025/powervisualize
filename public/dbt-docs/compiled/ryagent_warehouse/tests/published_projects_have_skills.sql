select
  p.project_id
from "neondb"."analytics"."dim_projects" p
left join "neondb"."analytics"."fct_project_skills" ps
  on ps.project_id = p.project_id
where p.status = 'published'
group by p.project_id
having count(ps.skill_id) = 0