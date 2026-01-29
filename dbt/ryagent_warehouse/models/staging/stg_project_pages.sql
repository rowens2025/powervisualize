select
  project_id,
  page_id,
  relationship
from {{ source('raw', 'project_pages') }}
