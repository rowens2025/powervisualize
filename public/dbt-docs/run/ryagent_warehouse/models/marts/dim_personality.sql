
  
    

  create  table "neondb"."analytics"."dim_personality__dbt_tmp"
  
  
    as
  
  (
    select
  personality_id,
  category,
  subcategory,
  value,
  public,
  created_at
from "neondb"."analytics"."stg_personality"
  );
  