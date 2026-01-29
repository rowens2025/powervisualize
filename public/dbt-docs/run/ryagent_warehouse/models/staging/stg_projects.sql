
  create view "neondb"."analytics"."stg_projects__dbt_tmp"
    
    
  as (
    select
  project_id,
  name,
  slug,
  summary,
  status,
  repo_url,
  demo_url,
  created_at,
  updated_at
from "neondb"."public"."projects"
  );