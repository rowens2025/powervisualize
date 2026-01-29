
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select project_id
from "neondb"."analytics"."stg_project_pages"
where project_id is null



  
  
      
    ) dbt_internal_test