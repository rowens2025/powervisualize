
  create view "neondb"."analytics"."stg_personality__dbt_tmp"
    
    
  as (
    select
  personality_id,
  category,
  subcategory,
  value,
  public,
  created_at
from "neondb"."public"."personality"
  );