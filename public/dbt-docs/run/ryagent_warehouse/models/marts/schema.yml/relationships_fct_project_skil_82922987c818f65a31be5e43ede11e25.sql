
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

with child as (
    select skill_id as from_field
    from "neondb"."analytics"."fct_project_skills"
    where skill_id is not null
),

parent as (
    select skill_id as to_field
    from "neondb"."analytics"."stg_skills"
)

select
    from_field

from child
left join parent
    on child.from_field = parent.to_field

where parent.to_field is null



  
  
      
    ) dbt_internal_test