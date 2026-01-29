select
  project_id,
  name,
  slug,
  summary,
  status,
  repo_url,
  demo_url,
  created_at,
  updated_at
from {{ source('raw', 'projects') }}
