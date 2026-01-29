select
  project_id,
  page_id,
  relationship
from {{ ref('stg_project_pages') }}
