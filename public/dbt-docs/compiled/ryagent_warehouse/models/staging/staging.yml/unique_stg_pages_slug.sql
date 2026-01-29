
    
    

select
    slug as unique_field,
    count(*) as n_records

from "neondb"."analytics"."stg_pages"
where slug is not null
group by slug
having count(*) > 1


