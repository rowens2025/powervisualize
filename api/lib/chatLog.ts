import type { Pool } from 'pg';
import type { PageContext } from './guardrails.js';

/**
 * Write-only audit log of RyAgent conversations, for the SITE OWNER to inspect
 * directly in Neon (e.g. `select * from ryagent_chat_log order by created_at desc`).
 *
 * IMPORTANT: this is intentionally write-only. There is no select/read path for
 * it anywhere in the app or API — visitors can never see this data. Inserts are
 * best-effort and swallow all errors so logging can never break or slow a chat.
 *
 * Table (public.ryagent_chat_log) is provisioned by scripts/create-chat-log.mjs.
 */
export type ChatLogRow = {
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
  page?: PageContext;
  question: string;
  answer: string;
  intent?: string;
  sourcesUsed?: string[];
  blocked?: boolean;
  truncated?: boolean;
  error?: string;
};

const CREATE_SQL = `
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
`;

// Memoize table creation per warm instance so the log works no matter which
// database this deployment's DATABASE_URL points at. Reset on failure to retry.
let ensured: Promise<void> | null = null;
function ensureTable(pool: Pool): Promise<void> {
  if (!ensured) {
    ensured = pool
      .query(CREATE_SQL)
      .then(() => undefined)
      .catch((err) => {
        ensured = null;
        throw err;
      });
  }
  return ensured;
}

/**
 * Persist one conversation turn. IMPORTANT: this MUST be awaited before the
 * request ends — on serverless (Vercel), the instance can freeze the moment the
 * response closes, so an un-awaited insert silently never runs. Errors are
 * swallowed (returns rather than throws) so logging can't break a chat.
 */
export async function logChatTurn(pool: Pool, row: ChatLogRow): Promise<void> {
  try {
    await ensureTable(pool);
    await pool.query(
      `insert into public.ryagent_chat_log
         (session_id, client_ip, user_agent, page_path, page_slug, page_type,
          question, answer, intent, sources_used, blocked, truncated, error)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        row.sessionId ?? null,
        row.clientIp ?? null,
        row.userAgent ? row.userAgent.slice(0, 500) : null,
        row.page?.path ?? null,
        row.page?.pageSlug ?? null,
        row.page?.pageType ?? null,
        row.question.slice(0, 2000),
        (row.answer ?? '').slice(0, 8000),
        row.intent ?? null,
        row.sourcesUsed && row.sourcesUsed.length ? row.sourcesUsed : null,
        !!row.blocked,
        !!row.truncated,
        row.error ?? null,
      ],
    );
  } catch (err: any) {
    console.error('[chatlog] insert failed (non-fatal):', err?.message ?? err);
  }
}
