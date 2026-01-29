with page_counts as (
  select
    fp.project_id,
    dp.page_type,
    count(*) as page_count
  from {{ ref('fct_project_pages') }} fp
  join {{ ref('dim_pages') }} dp on dp.page_id = fp.page_id
  group by fp.project_id, dp.page_type
),
skill_counts as (
  select
    project_id,
    count(*) as skills_count,
    sum(case when strength = 'primary' then 1 else 0 end) as primary_skills_count
  from {{ ref('fct_project_skills') }}
  group by project_id
)
select
  p.project_id,
  p.slug,
  coalesce(sc.skills_count, 0) as skills_count,
  coalesce(sc.primary_skills_count, 0) as primary_skills_count,
  coalesce(max(case when pc.page_type = 'dashboard' then pc.page_count end), 0) as dashboard_pages,
  coalesce(max(case when pc.page_type = 'project' then pc.page_count end), 0) as project_pages,
  coalesce(max(case when pc.page_type = 'writeup' then pc.page_count end), 0) as writeup_pages
from {{ ref('dim_projects') }} p
left join skill_counts sc on sc.project_id = p.project_id
left join page_counts pc on pc.project_id = p.project_id
group by p.project_id, p.slug, sc.skills_count, sc.primary_skills_count
