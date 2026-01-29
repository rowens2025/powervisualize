
  
    

  create  table "neondb"."analytics"."fct_project_pages__dbt_tmp"
  
  
    as
  
  (
    select
  project_id,
  page_id,
  relationship
from "neondb"."analytics"."stg_project_pages"
  );
  