import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { pool } from './_db.js';
import { searchPortfolio } from './_lib/retrieval.js';
import { buildSystemPrompt, describePage, getTools } from './_lib/ryPrompt.js';
import { runMortgageChart, type ChartSpec, type ChartRow } from './_lib/runViz.js';
import { logChatTurn } from './_lib/chatLog.js';
import {
  ACK_REPLY,
  MADISON_REPLIES,
  PERSONAL_REPLY,
  STRIKE_MESSAGES,
  WORK_STYLE_REPLY,
  addStrike,
  checkContentModeration,
  checkStrikes,
  classifyIntent,
  rateLimit,
  type ChatMsg,
  type PageContext,
} from './_lib/guardrails.js';

/**
 * Streaming RyAgent endpoint. Emits Server-Sent Events so the UI can show
 * thinking, tool progress, evidence, and token-by-token text. Structured after
 * FamilyVault's interview loop (generator of typed events), adapted to OpenAI
 * function calling and the portfolio marts.
 *
 * Event shapes (one JSON object per `data:` line):
 *   { type: 'thinking' }
 *   { type: 'tool_start', name, query }
 *   { type: 'tool_end',   name, summary, evidence: [{title,url}] }
 *   { type: 'text',       content }            // incremental
 *   { type: 'done',       meta }
 *   { type: 'error',      message }
 */

const MODEL = 'gpt-4o-mini';
const MAX_TOOL_TURNS = 3;

function getClientIp(req: VercelRequest): string | undefined {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string' && xfwd.length > 0) return xfwd.split(',')[0].trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) return realIp;
  return req.socket?.remoteAddress || undefined;
}

type SseEvent =
  | { type: 'thinking' }
  | { type: 'tool_start'; name: string; query: string }
  | { type: 'tool_end'; name: string; summary: string; evidence: { title: string; url: string }[] }
  | { type: 'chart'; chartSpec: ChartSpec; rows: ChartRow[] }
  | { type: 'text'; content: string }
  | { type: 'done'; meta?: Record<string, unknown> }
  | { type: 'error'; message: string };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  // Preflight guards (respond as normal JSON before opening the stream)
  const strikeCheck = checkStrikes(req);
  if (strikeCheck.lockedUntil) {
    const minutesLeft = Math.ceil((strikeCheck.lockedUntil - Date.now()) / 60000);
    res.status(200).json({
      blocked: true,
      answer: `Chat is temporarily locked due to policy violations. Please try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
      locked_until: new Date(strikeCheck.lockedUntil).toISOString(),
    });
    return;
  }
  const rl = rateLimit(req);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    res.status(429).json({ error: 'Rate limit exceeded. Please try again shortly.' });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfigured: OPENAI_API_KEY is not set.' });
    return;
  }

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  const history = Array.isArray(req.body?.history) ? (req.body.history as ChatMsg[]) : [];
  const pageContext = req.body?.pageContext as PageContext | undefined;
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.slice(0, 100) : undefined;
  const clientIp = getClientIp(req);
  const userAgent = typeof req.headers['user-agent'] === 'string' ? (req.headers['user-agent'] as string) : undefined;

  if (!question) {
    res.status(400).json({ error: 'Missing required field: question' });
    return;
  }
  if (question.length > 800) {
    res.status(400).json({ error: 'Question is too long (max 800 chars).' });
    return;
  }

  // Open the SSE stream
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  const send = (ev: SseEvent) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  // Buffer streamed text so we can persist the full answer to the write-only log.
  const answerParts: string[] = [];
  const streamText = (text: string) => {
    answerParts.push(text);
    send({ type: 'text', content: text });
  };
  const recordTurn = (extra: { intent?: string; blocked?: boolean; truncated?: boolean; error?: string; sourcesUsed?: string[] }) =>
    logChatTurn(pool, { sessionId, clientIp, userAgent, page: pageContext, question, answer: answerParts.join(''), ...extra });

  try {
    const intent = classifyIntent(question);

    // --- fast-path intents: one message, no model call ---
    if (intent === 'ACKNOWLEDGEMENT') {
      streamText(ACK_REPLY);
      send({ type: 'done', meta: { intent } });
      await recordTurn({ intent });
      return res.end();
    }
    if (intent === 'MADISON') {
      streamText(MADISON_REPLIES[Math.floor((Date.now() / 1000) % MADISON_REPLIES.length)]);
      send({ type: 'done', meta: { intent } });
      await recordTurn({ intent });
      return res.end();
    }
    if (intent === 'WORK_STYLE') {
      streamText(WORK_STYLE_REPLY);
      send({ type: 'done', meta: { intent } });
      await recordTurn({ intent });
      return res.end();
    }
    if (intent === 'PERSONAL') {
      streamText(PERSONAL_REPLY);
      send({ type: 'done', meta: { intent } });
      await recordTurn({ intent });
      return res.end();
    }
    if (intent === 'PAGE_CONTEXT') {
      const p = describePage(pageContext);
      const detail = p.blurb ? ` — ${p.blurb}.` : '.';
      streamText(`You're on ${p.label}${detail} Ask me anything about it${p.mode === 'mortgage' ? ", or tell me a chart to build" : ''}.`);
      send({ type: 'done', meta: { intent } });
      await recordTurn({ intent });
      return res.end();
    }

    // --- moderation for open-ended questions ---
    const moderation = checkContentModeration(question);
    if (!moderation.allowed) {
      if (moderation.severity === 'strike') {
        const strike = addStrike(req);
        streamText(STRIKE_MESSAGES[Math.min(strike.strikes - 1, STRIKE_MESSAGES.length - 1)]);
      } else {
        streamText("I can only help with Ryan's skills, projects, and data work. Ask about Power BI, Synapse, A/B testing, or his portfolio projects.");
      }
      send({ type: 'done', meta: { intent, blocked: true } });
      await recordTurn({ intent, blocked: true });
      return res.end();
    }

    // --- professional / personality: streaming tool-loop ---
    const client = new OpenAI({ apiKey });
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt(pageContext) },
      ...history.slice(-8).map((h) => ({ role: h.role, content: h.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
      { role: 'user', content: question },
    ];

    const sourcesUsed: string[] = [];
    send({ type: 'thinking' });

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const stream = await client.chat.completions.create({
        model: MODEL,
        messages,
        tools: getTools(pageContext),
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 700,
        stream: true,
      });

      let content = '';
      const toolCalls: { id: string; name: string; args: string }[] = [];
      let finishReason: string | null = null;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const delta = choice?.delta;
        if (delta?.content) {
          content += delta.content;
          streamText(delta.content);
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const i = tc.index;
            toolCalls[i] ??= { id: '', name: '', args: '' };
            if (tc.id) toolCalls[i].id = tc.id;
            if (tc.function?.name) toolCalls[i].name = tc.function.name;
            if (tc.function?.arguments) toolCalls[i].args += tc.function.arguments;
          }
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      }

      // No tool calls -> the model answered; we're done.
      if (finishReason !== 'tool_calls' || toolCalls.length === 0) {
        send({ type: 'done', meta: { intent, sources_used: sourcesUsed } });
        await recordTurn({ intent, sourcesUsed });
        return res.end();
      }

      // Record the assistant turn (with its tool calls) then execute each tool.
      messages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: toolCalls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } })),
      });

      for (const tc of toolCalls) {
        if (tc.name === 'search_portfolio') {
          let query = question;
          try {
            query = JSON.parse(tc.args || '{}').query || question;
          } catch {
            /* keep default */
          }
          send({ type: 'tool_start', name: tc.name, query });
          const result = await searchPortfolio(pool, query);
          sourcesUsed.push('db:mart_project_profile');

          const evidence = result.projects.flatMap((p) => p.pages.map((pg) => ({ title: pg.title, url: pg.url }))).slice(0, 4);
          const summary =
            result.projects.length > 0
              ? `Found ${result.projects.length} project${result.projects.length > 1 ? 's' : ''}${result.detectedSkill ? ` for ${result.detectedSkill}` : ''}: ${result.projects.map((p) => p.name).join(', ')}.`
              : 'No matching projects found in the portfolio.';
          send({ type: 'tool_end', name: tc.name, summary, evidence });

          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        } else if (tc.name === 'build_visualization') {
          let metricId = '';
          let chartType: ChartSpec['chartType'] | undefined;
          let excludeCategories: string[] | undefined;
          let includeCategories: string[] | undefined;
          let sort: 'asc' | 'desc' | undefined;
          let limit: number | undefined;
          try {
            const a = JSON.parse(tc.args || '{}');
            metricId = a.metricId;
            chartType = a.chartType;
            if (Array.isArray(a.excludeCategories)) excludeCategories = a.excludeCategories;
            if (Array.isArray(a.includeCategories)) includeCategories = a.includeCategories;
            if (a.sort === 'asc' || a.sort === 'desc') sort = a.sort;
            if (typeof a.limit === 'number') limit = a.limit;
          } catch {
            /* keep defaults */
          }
          send({ type: 'tool_start', name: tc.name, query: metricId || 'chart' });
          const out = await runMortgageChart({ metricId, chartType, excludeCategories, includeCategories, sort, limit });
          sourcesUsed.push('fannie:mortgage_chart');
          if (out.ok) {
            send({ type: 'chart', chartSpec: out.chartSpec, rows: out.rows });
            send({ type: 'tool_end', name: tc.name, summary: `Built chart: ${out.chartSpec.title} (${out.rows.length} points).`, evidence: [] });
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: `Rendered a ${out.chartSpec.chartType} chart titled "${out.chartSpec.title}" (${out.rows.length} data points) — it is now visible to the user. Describe what it shows in one short sentence; do not restate raw numbers.`,
            });
          } else {
            send({ type: 'tool_end', name: tc.name, summary: out.error, evidence: [] });
            messages.push({ role: 'tool', tool_call_id: tc.id, content: `Chart could not be built: ${out.error}` });
          }
        } else {
          messages.push({ role: 'tool', tool_call_id: tc.id, content: `Unknown tool "${tc.name}".` });
        }
      }
    }

    // Exhausted tool turns without a final answer.
    streamText('I hit my reasoning limit — please try rephrasing, or visit the contact section.');
    send({ type: 'done', meta: { intent, sources_used: sourcesUsed, truncated: true } });
    await recordTurn({ intent, sourcesUsed, truncated: true });
    return res.end();
  } catch (err: any) {
    console.error('[API] /api/chat error:', err?.message ?? err);
    send({ type: 'error', message: 'RyAgent hit a snag. Please try again.' });
    await recordTurn({ error: err?.message ? String(err.message).slice(0, 500) : 'unknown error' });
    return res.end();
  }
}
