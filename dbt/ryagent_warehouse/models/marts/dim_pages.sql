select
  page_id,
  slug,
  title,
  url,
  page_type,
  created_at,
  updated_at
from {{ ref('stg_pages') }}
