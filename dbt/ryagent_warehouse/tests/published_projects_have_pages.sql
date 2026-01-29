select
  p.project_id
from {{ ref('dim_projects') }} p
left join {{ ref('fct_project_pages') }} pp
  on pp.project_id = p.project_id
where p.status = 'published'
group by p.project_id
having count(pp.page_id) = 0
