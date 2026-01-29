
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

with all_values as (

    select
        skill_confidence as value_field,
        count(*) as n_records

    from "neondb"."analytics"."fct_project_skills"
    group by skill_confidence

)

select *
from all_values
where value_field not in (
    'expert','strong'
)



  
  
      
    ) dbt_internal_test