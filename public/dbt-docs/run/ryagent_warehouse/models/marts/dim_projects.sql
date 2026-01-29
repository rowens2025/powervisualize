
  
    

  create  table "neondb"."analytics"."dim_projects__dbt_tmp"
  
  
    as
  
  (
    select
  project_id,
  slug,
  name,
  summary,
  status,
  repo_url,
  demo_url,
  created_at,
  updated_at
from "neondb"."analytics"."stg_projects"
  );
  