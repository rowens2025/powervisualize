
  create view "neondb"."analytics"."stg_team_member_personality__dbt_tmp"
    
    
  as (
    select
  team_member_id,
  personality_id
from "neondb"."public"."team_member_personality"
  );