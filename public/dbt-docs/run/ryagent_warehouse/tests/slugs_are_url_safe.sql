
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  select slug
from "neondb"."analytics"."dim_projects"
where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  
  
      
    ) dbt_internal_test