with pages as (
  select
    fp.project_id,
    json_agg(
      json_build_object(
        'page_type', dp.page_type,
        'title', dp.title,
        'url', dp.url,
        'slug', dp.slug,
        'relationship', fp.relationship
      )
      order by dp.page_type, fp.relationship, dp.title
    ) as pages_json
  from "neondb"."analytics"."fct_project_pages" fp
  join "neondb"."analytics"."dim_pages" dp on dp.page_id = fp.page_id
  group by fp.project_id
),
skills as (
  select
    project_id,
    json_agg(
      json_build_object(
        'skill', skill_name,
        'confidence', skill_confidence,
        'strength', strength,
        'proof_weight', proof_weight
      )
      order by (case when strength='primary' then 0 else 1 end), proof_weight desc, skill_name
    ) as skills_json
  from "neondb"."analytics"."fct_project_skills"
  group by project_id
)
select
  p.project_id,
  p.slug,
  p.name,
  p.summary,
  p.status,
  p.repo_url,
  p.demo_url,
  coalesce(pg.pages_json, '[]'::json) as pages,
  coalesce(sk.skills_json, '[]'::json) as skills
from "neondb"."analytics"."dim_projects" p
left join pages pg on pg.project_id = p.project_id
left join skills sk on sk.project_id = p.project_id