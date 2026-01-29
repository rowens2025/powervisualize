# Database Setup for RyAgent

RyAgent uses Neon Postgres as its primary source of truth for portfolio data. This document outlines the required database setup.

## Environment Variables

Add the following environment variable to your Vercel project (or local `.env`):

```
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

## Required Database Schema

RyAgent expects the following dbt marts and tables:

### Tables/Marts

1. **`analytics.mart_project_profile`**
   - One row per project
   - Columns: `project_id`, `slug`, `name`, `summary`, `status`, `pages` (JSONB), `skills` (JSONB)

2. **`analytics.fct_project_counts`**
   - Counts per project
   - Columns: `project_id`, `skills_count`, `dashboard_pages`, etc.

3. **`analytics.dim_projects`**
   - Project dimension table
   - Columns: `project_id`, `name`, `slug`, `summary`, `status`

4. **`analytics.stg_skills`**
   - Skills staging table with aliases
   - Columns: `skill_id`, `name`, `confidence`, `aliases` (JSONB array)

5. **`analytics.fct_project_skills`** (optional, for skill-to-project mapping)
   - Fact table linking projects to skills
   - Columns: `project_id`, `skill_id`, `proof_weight`

## SQL Setup (Run in Neon SQL Editor)

### Required: Enable Trigram Extension

RyAgent uses PostgreSQL's `pg_trgm` extension for fuzzy matching. This is **required**:

```sql
-- Enable pg_trgm extension (REQUIRED)
create extension if not exists pg_trgm;
```

### Required: Add Trigram Indexes

These indexes are **required** for fast trigram matching. They are safe and cheap for typical portfolio dataset sizes:

```sql
-- Fuzzy match projects (REQUIRED)
create index if not exists idx_dim_projects_name_trgm
  on analytics.dim_projects using gin (name gin_trgm_ops);

create index if not exists idx_dim_projects_slug_trgm
  on analytics.dim_projects using gin (slug gin_trgm_ops);

create index if not exists idx_dim_projects_summary_trgm
  on analytics.dim_projects using gin (summary gin_trgm_ops);

-- Fuzzy match pages (optional but helpful)
create index if not exists idx_dim_pages_title_trgm
  on analytics.dim_pages using gin (title gin_trgm_ops);

create index if not exists idx_dim_pages_slug_trgm
  on analytics.dim_pages using gin (slug gin_trgm_ops);
```

## Query Pattern

RyAgent uses trigram similarity search (`%` operator and `similarity()` function) for fuzzy matching:

### Project Matching
```sql
select
  p.project_id,
  p.slug,
  p.name,
  p.summary,
  greatest(
    similarity(p.name, $1),
    similarity(p.slug, $1),
    similarity(coalesce(p.summary,''), $1)
  ) as score
from analytics.dim_projects p
where
  p.name % $1
  or p.slug % $1
  or coalesce(p.summary,'') % $1
order by score desc
limit 5
```

### Skill Matching (Trigram)
```sql
select
  s.skill_id,
  s.name as skill_name,
  s.confidence,
  similarity(s.name, $1) as score
from analytics.stg_skills s
where s.name % $1
order by score desc
limit 10
```

### Skill Matching (Alias)
```sql
select distinct
  s.skill_id,
  s.name as skill_name,
  s.confidence,
  a.alias_text
from analytics.stg_skills s
cross join lateral (
  select lower(value::text) as alias_text
  from jsonb_array_elements_text(coalesce(s.aliases,'[]'::jsonb)) as value
) a
where a.alias_text like '%' || lower($1) || '%'
limit 20
```

## Fallback Behavior

If `DATABASE_URL` is not set or queries fail, RyAgent falls back to JSON files:
- `data/resume_canonical.json`
- `data/skills_matrix.json`
- `data/projects.json`

This ensures resilience during migration and development.
