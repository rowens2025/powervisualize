select
  project_id,
  slug,
  name,
  summary,
  status,
  repo_url,
  demo_url,
  created_at,
  updated_at
from {{ ref('stg_projects') }}
