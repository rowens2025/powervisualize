select
  personality_id,
  category,
  subcategory,
  value,
  public,
  created_at
from {{ source('raw', 'personality') }}
