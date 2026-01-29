select slug
from "neondb"."analytics"."dim_projects"
where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'