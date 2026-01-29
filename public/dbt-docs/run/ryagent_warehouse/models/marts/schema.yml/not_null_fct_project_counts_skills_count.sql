
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select skills_count
from "neondb"."analytics"."fct_project_counts"
where skills_count is null



  
  
      
    ) dbt_internal_test