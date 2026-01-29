
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select strength
from "neondb"."analytics"."fct_project_skills"
where strength is null



  
  
      
    ) dbt_internal_test