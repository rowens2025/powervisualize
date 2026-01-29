
    
    

with all_values as (

    select
        relationship as value_field,
        count(*) as n_records

    from "neondb"."analytics"."fct_project_pages"
    group by relationship

)

select *
from all_values
where value_field not in (
    'primary','supporting'
)


