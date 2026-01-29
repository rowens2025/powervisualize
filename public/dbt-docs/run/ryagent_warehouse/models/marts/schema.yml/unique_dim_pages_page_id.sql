
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

select
    page_id as unique_field,
    count(*) as n_records

from "neondb"."analytics"."dim_pages"
where page_id is not null
group by page_id
having count(*) > 1



  
  
      
    ) dbt_internal_test