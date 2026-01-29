select
  personality_id,
  category,
  subcategory,
  value,
  public,
  created_at
from {{ ref('stg_personality') }}
