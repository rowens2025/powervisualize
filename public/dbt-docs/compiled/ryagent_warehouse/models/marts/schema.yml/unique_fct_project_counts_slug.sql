
    
    

select
    slug as unique_field,
    count(*) as n_records

from "neondb"."analytics"."fct_project_counts"
where slug is not null
group by slug
having count(*) > 1


