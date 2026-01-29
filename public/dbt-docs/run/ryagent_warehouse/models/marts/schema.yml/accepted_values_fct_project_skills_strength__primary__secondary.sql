
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

with all_values as (

    select
        strength as value_field,
        count(*) as n_records

    from "neondb"."analytics"."fct_project_skills"
    group by strength

)

select *
from all_values
where value_field not in (
    'primary','secondary'
)



  
  
      
    ) dbt_internal_test