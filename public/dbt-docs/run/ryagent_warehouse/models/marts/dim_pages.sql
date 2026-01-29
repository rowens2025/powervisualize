
  
    

  create  table "neondb"."analytics"."dim_pages__dbt_tmp"
  
  
    as
  
  (
    select
  page_id,
  slug,
  title,
  url,
  page_type,
  created_at,
  updated_at
from "neondb"."analytics"."stg_pages"
  );
  