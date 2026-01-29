
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select proof_weight
from "neondb"."analytics"."fct_project_skills"
where proof_weight is null



  
  
      
    ) dbt_internal_test