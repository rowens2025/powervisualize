
    
    

select
    project_id || '-' || skill_id as unique_field,
    count(*) as n_records

from "neondb"."analytics"."fct_project_skills"
where project_id || '-' || skill_id is not null
group by project_id || '-' || skill_id
having count(*) > 1


