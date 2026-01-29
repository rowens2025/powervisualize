
  create view "neondb"."analytics"."stg_project_skills__dbt_tmp"
    
    
  as (
    select
  project_id,
  skill_id,
  strength,
  proof_weight
from "neondb"."public"."project_skills"
  );