
  
    

  create  table "neondb"."analytics"."fct_project_skills__dbt_tmp"
  
  
    as
  
  (
    select
  ps.project_id,
  ps.skill_id,
  ps.strength,
  ps.proof_weight,
  s.name as skill_name,
  s.confidence as skill_confidence
from "neondb"."analytics"."stg_project_skills" ps
join "neondb"."analytics"."stg_skills" s
  on s.skill_id = ps.skill_id
  );
  