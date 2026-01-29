
    
    

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


