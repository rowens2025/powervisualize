
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select slug
from "neondb"."analytics"."fct_project_counts"
where slug is null



  
  
      
    ) dbt_internal_test