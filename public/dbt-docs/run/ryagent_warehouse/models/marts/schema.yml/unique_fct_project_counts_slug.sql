
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

select
    slug as unique_field,
    count(*) as n_records

from "neondb"."analytics"."fct_project_counts"
where slug is not null
group by slug
having count(*) > 1



  
  
      
    ) dbt_internal_test