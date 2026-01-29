
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select dashboard_pages
from "neondb"."analytics"."fct_project_counts"
where dashboard_pages is null



  
  
      
    ) dbt_internal_test