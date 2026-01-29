
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select page_type
from "neondb"."analytics"."dim_pages"
where page_type is null



  
  
      
    ) dbt_internal_test