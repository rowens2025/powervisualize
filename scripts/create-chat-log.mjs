/**
 * Provision the write-only RyAgent conversation audit log in Neon.
 *
 * Usage:  node scripts/create-chat-log.mjs [pathToEnvFile]
 * Reads DATABASE_URL from the given env file (default: .env.local) and creates
 * public.ryagent_chat_log if it does not exist. Safe to re-run (idempotent).
 *
 * This table is WRITE-ONLY from the app; inspect it manually, e.g.:
 *   select created_at, client_ip, page_path, question, answer
 *   from ryagent_chat_log order by created_at desc limit 100;
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const envPath = process.argv[2] || '.env.local';
const env = readFileSync(envPath, 'utf8');
const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
const connectionString = line ? line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '') : '';
if (!connectionString) throw new Error(`DATABASE_URL not found in ${envPath}`);

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 15000 });

const ddl = `
CREATE TABLE IF NOT EXISTS public.ryagent_chat_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  session_id    text,
  client_ip     text,
  user_agent    text,
  page_path     text,
  page_slug     text,
  page_type     text,
  question      text,
  answer        text,
  intent        text,
  sources_used  text[],
  blocked       boolean NOT NULL DEFAULT false,
  truncated     boolean NOT NULL DEFAULT false,
  error         text
);
CREATE INDEX IF NOT EXISTS ryagent_chat_log_created_at_idx ON public.ryagent_chat_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ryagent_chat_log_session_idx ON public.ryagent_chat_log (session_id);
`;

try {
  await pool.query(ddl);
  const { rows } = await pool.query("select count(*)::int as n from public.ryagent_chat_log");
  console.log('OK ryagent_chat_log ready; existing rows:', rows[0].n);
} finally {
  await pool.end();
}
