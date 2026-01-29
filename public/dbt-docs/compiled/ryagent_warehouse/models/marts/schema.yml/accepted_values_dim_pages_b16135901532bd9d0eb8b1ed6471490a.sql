
    
    

with all_values as (

    select
        page_type as value_field,
        count(*) as n_records

    from "neondb"."analytics"."dim_pages"
    group by page_type

)

select *
from all_values
where value_field not in (
    'home','about','project','dashboard','writeup','assistant'
)


