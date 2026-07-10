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

export function logChatTurn(pool: Pool, row: ChatLogRow): void {
  // Fire-and-forget: never await in the request path, never throw.
  void pool
    .query(
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
    )
    .catch((err: any) => {
      console.error('[chatlog] insert failed (non-fatal):', err?.message ?? err);
    });
}
