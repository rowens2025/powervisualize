
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

select
    project_id || '-' || skill_id as unique_field,
    count(*) as n_records

from "neondb"."analytics"."fct_project_skills"
where project_id || '-' || skill_id is not null
group by project_id || '-' || skill_id
having count(*) > 1



  
  
      
    ) dbt_internal_test