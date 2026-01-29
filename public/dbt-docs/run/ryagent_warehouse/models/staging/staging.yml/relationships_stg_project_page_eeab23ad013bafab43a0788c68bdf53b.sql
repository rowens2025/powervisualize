
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

with child as (
    select project_id as from_field
    from "neondb"."analytics"."stg_project_pages"
    where project_id is not null
),

parent as (
    select project_id as to_field
    from "neondb"."analytics"."stg_projects"
)

select
    from_field

from child
left join parent
    on child.from_field = parent.to_field

where parent.to_field is null



  
  
      
    ) dbt_internal_test