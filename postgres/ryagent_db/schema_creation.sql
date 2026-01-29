-- =========================
-- Team members
-- =========================
create table if not exists team_members (
  team_member_id uuid primary key default gen_random_uuid(),
  display_name text not null,
  primary_member boolean default false,
  phone text,
  email text,
  created_at timestamp default now()
);

-- =========================
-- Projects
-- =========================
create table if not exists projects (
  project_id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  summary text,
  status text not null default 'draft' check (status in ('published','draft')),
  repo_url text,
  demo_url text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists team_member_projects (
  team_member_id uuid references team_members(team_member_id) on delete cascade,
  project_id uuid references projects(project_id) on delete cascade,
  role text default 'owner',
  primary key (team_member_id, project_id)
);

-- =========================
-- Pages (site content / routes / dashboards / writeups)
-- =========================
create table if not exists pages (
  page_id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  url text not null,
  page_type text not null check (page_type in ('home','about','project','dashboard','writeup','assistant')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Many-to-many (supports one project -> many pages, one page -> many projects)
create table if not exists project_pages (
  project_id uuid references projects(project_id) on delete cascade,
  page_id uuid references pages(page_id) on delete cascade,
  relationship text not null default 'primary' check (relationship in ('primary','supporting')),
  primary key (project_id, page_id)
);

-- =========================
-- Skills (source of truth via ProjectSkills)
-- =========================
create table if not exists skills (
  skill_id uuid primary key default gen_random_uuid(),
  name text unique not null,
  confidence text not null check (confidence in ('expert','strong')),
  summary text,
  aliases jsonb default '[]'::jsonb
);

create table if not exists project_skills (
  project_id uuid references projects(project_id) on delete cascade,
  skill_id uuid references skills(skill_id) on delete cascade,
  strength text not null check (strength in ('primary','secondary')),
  proof_weight int default 3 check (proof_weight between 1 and 5),
  primary key (project_id, skill_id)
);

-- =========================
-- Personality (your "Favorites" generalized)
-- =========================
create table if not exists personality (
  personality_id uuid primary key default gen_random_uuid(),
  category text not null,       -- e.g. favorites, location, values, work_style
  subcategory text not null,    -- e.g. food, activities, city
  value text not null,          -- e.g. Indian, Snowboarding, Philadelphia
  public boolean default true,
  created_at timestamp default now()
);

create table if not exists team_member_personality (
  team_member_id uuid references team_members(team_member_id) on delete cascade,
  personality_id uuid references personality(personality_id) on delete cascade,
  primary key (team_member_id, personality_id)
);

-- =========================
-- Objects (files/images/text references)
-- NOTE: don't store large binaries in Postgres; store URLs + optional text_content
-- =========================
create table if not exists objects (
  object_id uuid primary key default gen_random_uuid(),
  object_type text not null check (object_type in ('text','image','pdf','link')),
  title text not null,
  description text,
  storage_url text,
  text_content text,
  public boolean default false,
  tags jsonb default '[]'::jsonb,
  created_at timestamp default now()
);

create table if not exists team_member_objects (
  team_member_id uuid references team_members(team_member_id) on delete cascade,
  object_id uuid references objects(object_id) on delete cascade,
  usage text not null check (usage in ('resume','story','proof','prompt','photo')),
  primary key (team_member_id, object_id)
);

create table if not exists project_objects (
  project_id uuid references projects(project_id) on delete cascade,
  object_id uuid references objects(object_id) on delete cascade,
  primary key (project_id, object_id)
);
