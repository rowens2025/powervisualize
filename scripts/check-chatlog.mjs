// Verify dashboard-builder turns are landing in the Neon chat log. Read-only check.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
const connectionString = line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 2, connectionTimeoutMillis: 20000 });

const r = await pool.query(
  `select created_at, intent, page_type, question, left(answer, 80) as answer_snip, sources_used
   from public.ryagent_chat_log
   where intent = 'dashboard-builder'
   order by created_at desc limit 8`,
);
console.log(`dashboard-builder rows: ${r.rowCount}`);
for (const row of r.rows) {
  console.log(`\n[${row.created_at.toISOString()}] sources=${JSON.stringify(row.sources_used)}`);
  console.log(`  Q: ${row.question}`);
  console.log(`  A: ${row.answer_snip}`);
}
await pool.end();
