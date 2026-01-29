
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select slug
from "neondb"."analytics"."mart_project_profile"
where slug is null



  
  
      
    ) dbt_internal_test