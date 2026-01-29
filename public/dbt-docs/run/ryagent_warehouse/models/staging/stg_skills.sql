
  create view "neondb"."analytics"."stg_skills__dbt_tmp"
    
    
  as (
    select
  skill_id,
  name,
  confidence,
  summary,
  aliases
from "neondb"."public"."skills"
  );