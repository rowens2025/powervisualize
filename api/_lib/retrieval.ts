/**
 * Portfolio retrieval over the dbt marts. Exposed to the streaming chat loop as
 * a tool the model calls on demand (rather than pre-stuffing every payload).
 * Read-only; returns a compact evidence bundle the model grounds its answer in.
 */
import type { Pool } from 'pg';

export type EvidenceProject = {
  slug: string;
  name: string;
  summary: string | null;
  status: string | null;
  skills: { skill: string; confidence?: string; strength?: string; proof_weight?: number }[];
  pages: { title: string; url: string; page_type?: string }[];
};

export type RetrievalResult = {
  detectedSkill: string | null;
  matchType: 'skill' | 'trigram' | 'none';
  projects: EvidenceProject[];
  globalStats: { published_projects: number; total_skills: number; total_dashboard_pages: number };
};

/** Public-facing normalization for the legacy mortgage marts slugs. */
const MORTGAGE_SLUGS = new Set(['freddie-mac-portfolio-marts', 'fannie-mae-portfolio-marts']);
const MORTGAGE_DEEP_LINK = 'https://www.powervisualize.com/data-projects/mortgage-portfolio-intelligence';

export async function searchPortfolio(pool: Pool, question: string): Promise<RetrievalResult> {
  const lower = question.toLowerCase();

  const statsResult = await pool.query(`
    select
      (select count(*) filter (where status = 'published') from analytics.dim_projects) as published_projects,
      (select count(*) from public.skills) as total_skills,
      (select count(*) from analytics.dim_pages where page_type = 'dashboard') as total_dashboard_pages
  `);
  const s = statsResult.rows[0] || {};
  const globalStats = {
    published_projects: parseInt(s.published_projects || '0', 10),
    total_skills: parseInt(s.total_skills || '0', 10),
    total_dashboard_pages: parseInt(s.total_dashboard_pages || '0', 10),
  };

  // 1) Detect a skill mentioned in the question (name or alias contained in text)
  let detectedSkill: string | null = null;
  try {
    const skillMatch = await pool.query(
      `
      select s.name as skill_name, length(s.name) as name_length
      from analytics.stg_skills s
      where (length(s.name) >= 3 and lower($1) like '%' || lower(s.name) || '%')
        or exists (
          select 1 from jsonb_array_elements_text(coalesce(s.aliases,'[]'::jsonb)) as alias_val
          -- ignore 1-2 char aliases (e.g. "M", "R") that match stray letters in prose
          where length(alias_val) >= 3 and lower($1) like '%' || lower(alias_val) || '%'
        )
      order by name_length desc
      limit 1
      `,
      [lower],
    );
    if (skillMatch.rows.length > 0) detectedSkill = skillMatch.rows[0].skill_name;
    if (!detectedSkill && (lower.includes('dbt') || lower.includes('data build tool'))) {
      const dbtMatch = await pool.query(
        `select name as skill_name from analytics.stg_skills where lower(name) like '%dbt%' order by length(name) desc limit 1`,
      );
      if (dbtMatch.rows.length > 0) detectedSkill = dbtMatch.rows[0].skill_name;
    }
  } catch {
    /* fall through to trigram */
  }

  // 2) Get candidate project ids
  let projectIds: string[] = [];
  let matchType: RetrievalResult['matchType'] = 'none';

  // 2a) Mortgage shortcut — the project's public name ("Mortgage Portfolio
  // Intelligence" / Fannie Mae) differs from its stored DB name ("Freddie
  // Mac..."), so a plain search never finds it. Map the synonyms directly.
  if (/\b(mortgage|fannie|freddie|delinquen\w*|portfolio intelligence)\b/i.test(lower)) {
    const m = await pool.query(`select project_id from analytics.dim_projects where slug = any($1)`, [Array.from(MORTGAGE_SLUGS)]);
    if (m.rows.length > 0) {
      projectIds = m.rows.map((r: any) => r.project_id);
      matchType = 'trigram';
      detectedSkill = null; // it's a project match, not a skill
    }
  }

  if (projectIds.length === 0 && detectedSkill) {
    const skillProjects = await pool.query(
      `
      select distinct p.project_id, max(ps.proof_weight) as proof_weight
      from analytics.dim_projects p
      join analytics.fct_project_skills ps on ps.project_id = p.project_id
      join analytics.stg_skills sk on sk.skill_id = ps.skill_id
      where lower(sk.name) = lower($1)
      group by p.project_id
      order by proof_weight desc nulls last
      limit 3
      `,
      [detectedSkill],
    );
    if (skillProjects.rows.length > 0) {
      projectIds = skillProjects.rows.map((r: any) => r.project_id);
      matchType = 'skill';
    }
  }

  if (projectIds.length === 0) {
    const trigram = await pool.query(
      `
      select p.project_id,
        greatest(similarity(p.name,$1), similarity(p.slug,$1), similarity(coalesce(p.summary,''),$1)) as score
      from analytics.dim_projects p
      where p.name % $1 or p.slug % $1 or coalesce(p.summary,'') % $1
      order by score desc
      limit 3
      `,
      [question.trim()],
    );
    if (trigram.rows.length > 0) {
      projectIds = trigram.rows.map((r: any) => r.project_id);
      matchType = 'trigram';
    }
  }

  // 2c) ILIKE fallback for short topical terms trigram misses (e.g. "geospatial",
  // "flood", "steel"). Parameterized values only — no user text in the SQL body.
  if (projectIds.length === 0) {
    const words = Array.from(new Set(lower.split(/\W+/).filter((w) => w.length > 3))).slice(0, 4);
    if (words.length > 0) {
      const clauses = words.map((_, i) => `lower(name) like $${i + 1} or lower(coalesce(summary,'')) like $${i + 1}`).join(' or ');
      const il = await pool.query(
        `select project_id from analytics.dim_projects where status = 'published' and (${clauses}) limit 3`,
        words.map((w) => `%${w}%`),
      );
      if (il.rows.length > 0) {
        projectIds = il.rows.map((r: any) => r.project_id);
        matchType = 'trigram';
      }
    }
  }

  if (projectIds.length === 0) {
    return { detectedSkill, matchType: 'none', projects: [], globalStats };
  }

  // 3) Fetch full profiles
  const profiles = await pool.query(
    `select project_id, slug, name, summary, status, pages, skills
     from analytics.mart_project_profile where project_id = any($1::uuid[])`,
    [projectIds],
  );

  const projects: EvidenceProject[] = profiles.rows.map((p: any) => {
    const isMortgage = MORTGAGE_SLUGS.has(p.slug);
    let pages = Array.isArray(p.pages) ? p.pages : [];
    if (isMortgage && !pages.some((x: any) => String(x.url || '').startsWith(MORTGAGE_DEEP_LINK))) {
      pages = [{ title: 'Mortgage Portfolio Intelligence', url: MORTGAGE_DEEP_LINK, page_type: 'project' }, ...pages];
    }
    return {
      slug: p.slug,
      name: isMortgage ? 'Mortgage Portfolio Intelligence' : p.name,
      summary: p.summary ?? null,
      status: p.status ?? null,
      skills: (Array.isArray(p.skills) ? p.skills : []).slice(0, 8),
      pages: pages
        .filter((x: any) => x && x.url)
        .map((x: any) => ({ title: x.title || 'Page', url: x.url, page_type: x.page_type }))
        .slice(0, 5),
    };
  });

  return { detectedSkill, matchType, projects, globalStats };
}
