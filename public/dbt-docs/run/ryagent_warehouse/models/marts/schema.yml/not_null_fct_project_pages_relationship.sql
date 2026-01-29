
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select relationship
from "neondb"."analytics"."fct_project_pages"
where relationship is null



  
  
      
    ) dbt_internal_test