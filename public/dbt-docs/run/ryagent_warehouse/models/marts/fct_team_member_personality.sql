
  
    

  create  table "neondb"."analytics"."fct_team_member_personality__dbt_tmp"
  
  
    as
  
  (
    select
  team_member_id,
  personality_id
from "neondb"."analytics"."stg_team_member_personality"
  );
  