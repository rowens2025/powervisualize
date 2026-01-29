
    
    

select
    project_id as unique_field,
    count(*) as n_records

from "neondb"."analytics"."dim_projects"
where project_id is not null
group by project_id
having count(*) > 1


