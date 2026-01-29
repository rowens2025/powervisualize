
    
    

select
    page_id as unique_field,
    count(*) as n_records

from "neondb"."analytics"."dim_pages"
where page_id is not null
group by page_id
having count(*) > 1


