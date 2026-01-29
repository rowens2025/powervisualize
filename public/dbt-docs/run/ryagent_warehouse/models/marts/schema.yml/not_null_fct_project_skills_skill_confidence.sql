
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select skill_confidence
from "neondb"."analytics"."fct_project_skills"
where skill_confidence is null



  
  
      
    ) dbt_internal_test