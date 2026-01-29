
    
    

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


