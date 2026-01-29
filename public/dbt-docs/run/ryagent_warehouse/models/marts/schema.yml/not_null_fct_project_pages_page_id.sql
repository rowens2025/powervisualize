
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select page_id
from "neondb"."analytics"."fct_project_pages"
where page_id is null



  
  
      
    ) dbt_internal_test