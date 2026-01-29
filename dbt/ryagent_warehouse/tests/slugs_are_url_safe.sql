select slug
from {{ ref('dim_projects') }}
where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
