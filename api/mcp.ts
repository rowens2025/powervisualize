import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runSportsQuery } from './lib/runSports.js';
import { describeSportsLayer, SPORTS_METRICS } from './lib/sportsMetrics.js';

/**
 * Remote MCP server for the MLB sports data source (Streamable HTTP transport,
 * stateless — paste this URL into Claude as a custom connector):
 *
 *   https://<host>/api/mcp
 *
 * Two kinds of tools, deliberately paired to show warehouse + live data side
 * by side:
 *   - Warehouse (governed semantic layer, read-only): list_metrics, run_metric
 *   - Live ESPN (data that is NOT in the warehouse):  todays_games, player_boxscore
 *
 * The server is read-only by construction: warehouse tools can only select a
 * curated metric + whitelisted filters (never SQL), and the live tools call
 * ESPN's public endpoints. No auth, no sessions, no writes.
 */

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'powervisualize-mlb', title: 'PowerVisualize MLB Analytics', version: '1.0.0' };
const INSTRUCTIONS =
  'MLB analytics for powervisualize.com. Season/team standings and trends come from the governed warehouse ' +
  '(call list_metrics once to see what is queryable, then run_metric). Player-level stats are NOT in the ' +
  'warehouse — use todays_games to find live/recent game ids, then player_boxscore for batting and pitching lines.';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb';

// ---------------------------------------------------------------------------
// Rate limiting (per IP, per instance)

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;
const rateMap = new Map<string, { count: number; resetAt: number }>();
function rateLimited(req: VercelRequest): boolean {
  const xfwd = req.headers['x-forwarded-for'];
  const ip = (typeof xfwd === 'string' && xfwd.split(',')[0].trim()) || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

// ---------------------------------------------------------------------------
// Tools

const TOOLS = [
  {
    name: 'list_metrics',
    title: 'List warehouse metrics',
    description:
      'Describe the governed MLB semantic layer: every queryable metric (standings, run totals, per-team trends), ' +
      'its dimensions (season, team), and how to call run_metric. Read this first.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'run_metric',
    title: 'Run a warehouse metric',
    description:
      'Run one governed, read-only query against the MLB warehouse (daily ESPN scores modeled with dbt). ' +
      `Metrics: ${SPORTS_METRICS.map((m) => m.id).join(', ')}. Returns rows of {category, value}.`,
    inputSchema: {
      type: 'object',
      properties: {
        metric: { type: 'string', description: 'A metric id from list_metrics.' },
        season: { type: 'number', description: 'Season year (defaults to the latest).' },
        team: { type: 'string', description: '2-3 letter team code, e.g. LAD. Required for team_cumulative_wins.' },
        sort: { type: 'string', enum: ['asc', 'desc'] },
        limit: { type: 'number', description: 'Top-N rows, 3-30 (default 10). Use 30 for all teams.' },
      },
      required: ['metric'],
      additionalProperties: false,
    },
  },
  {
    name: 'todays_games',
    title: "Today's MLB games (live)",
    description:
      "List MLB games for today (or a given date) straight from ESPN's live scoreboard — matchup, status, score, " +
      'and the eventId to pass to player_boxscore. This is live data, not warehouse data.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Optional YYYY-MM-DD (defaults to today, US/Eastern).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'player_boxscore',
    title: 'Player box score (live)',
    description:
      'Player-level batting and pitching lines for one MLB game, fetched live from ESPN (player data is not in ' +
      'the warehouse). Get the eventId from todays_games. Works for in-progress and completed games.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'ESPN event id from todays_games.' },
        team: { type: 'string', description: 'Optional 2-3 letter team code to return just one side.' },
      },
      required: ['eventId'],
      additionalProperties: false,
    },
  },
];

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

const ok = (text: string): ToolResult => ({ content: [{ type: 'text', text }] });
const fail = (text: string): ToolResult => ({ content: [{ type: 'text', text }], isError: true });

/** Today's date string (YYYYMMDD) in US/Eastern, where MLB schedules live. */
function easternYyyymmdd(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts.replace(/-/g, '');
}

async function toolTodaysGames(args: any): Promise<ToolResult> {
  let dates = easternYyyymmdd();
  let label = 'today';
  if (typeof args?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.date.trim())) {
    dates = args.date.trim().replace(/-/g, '');
    label = args.date.trim();
  }
  const resp = await fetch(`${ESPN_BASE}/scoreboard?dates=${dates}`, { headers: { accept: 'application/json' } });
  if (!resp.ok) return fail(`ESPN scoreboard returned ${resp.status}.`);
  const data: any = await resp.json();
  const games = (data?.events ?? []).map((e: any) => {
    const comp = e?.competitions?.[0];
    const side = (ha: string) => {
      const c = (comp?.competitors ?? []).find((x: any) => x.homeAway === ha);
      return { team: c?.team?.abbreviation ?? '?', score: c?.score ?? '' };
    };
    const home = side('home');
    const away = side('away');
    return {
      eventId: String(e?.id ?? ''),
      matchup: e?.shortName ?? `${away.team} @ ${home.team}`,
      status: e?.status?.type?.detail ?? e?.status?.type?.name ?? 'unknown',
      away: `${away.team} ${away.score}`.trim(),
      home: `${home.team} ${home.score}`.trim(),
      startTime: e?.date ?? null,
    };
  });
  if (games.length === 0) return ok(`No MLB games scheduled for ${label}.`);
  return ok(JSON.stringify({ date: label, games }, null, 2));
}

async function toolPlayerBoxscore(args: any): Promise<ToolResult> {
  const eventId = typeof args?.eventId === 'string' ? args.eventId.trim() : String(args?.eventId ?? '').trim();
  if (!/^\d{5,12}$/.test(eventId)) return fail('eventId must be a numeric ESPN event id (get one from todays_games).');
  const teamFilter = typeof args?.team === 'string' ? args.team.trim().toUpperCase() : undefined;

  const resp = await fetch(`${ESPN_BASE}/summary?event=${eventId}`, { headers: { accept: 'application/json' } });
  if (!resp.ok) return fail(`ESPN summary returned ${resp.status} for event ${eventId}.`);
  const data: any = await resp.json();

  const comp = data?.header?.competitions?.[0];
  const scoreline = (comp?.competitors ?? [])
    .map((c: any) => `${c?.team?.abbreviation ?? '?'} ${c?.score ?? ''}`.trim())
    .join(' — ');
  const status = comp?.status?.type?.detail ?? comp?.status?.type?.name ?? 'unknown';

  const teams = (data?.boxscore?.players ?? []).filter(
    (t: any) => !teamFilter || String(t?.team?.abbreviation ?? '').toUpperCase() === teamFilter,
  );
  if (teams.length === 0) {
    return fail(
      teamFilter
        ? `No box score for team "${teamFilter}" in event ${eventId}.`
        : `No player box score available for event ${eventId} (it may not have started).`,
    );
  }

  const lines: string[] = [`${scoreline} (${status})`];
  for (const t of teams) {
    lines.push('', `=== ${t?.team?.displayName ?? t?.team?.abbreviation ?? 'Team'} ===`);
    for (const group of t?.statistics ?? []) {
      const type = String(group?.type ?? 'stats').toUpperCase();
      const labels = (group?.labels ?? []).join(' ');
      lines.push(`${type} (${labels})`);
      for (const a of group?.athletes ?? []) {
        const name = a?.athlete?.displayName ?? 'Unknown';
        const pos = a?.position?.abbreviation ?? a?.athlete?.position?.abbreviation ?? '';
        const stats = (a?.stats ?? []).join(' ');
        if (stats.trim()) lines.push(`  ${name}${pos ? ` ${pos}` : ''}: ${stats}`);
      }
      const totals = (group?.totals ?? []).join(' ');
      if (totals.trim()) lines.push(`  TEAM: ${totals}`);
    }
  }
  return ok(lines.join('\n'));
}

async function callTool(name: string, args: any): Promise<ToolResult> {
  switch (name) {
    case 'list_metrics':
      return ok(JSON.stringify(describeSportsLayer(), null, 2));
    case 'run_metric': {
      const out = await runSportsQuery({
        metric: typeof args?.metric === 'string' ? args.metric : '',
        season: typeof args?.season === 'number' ? args.season : undefined,
        team: typeof args?.team === 'string' ? args.team : undefined,
        sort: args?.sort === 'asc' || args?.sort === 'desc' ? args.sort : undefined,
        limit: typeof args?.limit === 'number' ? args.limit : undefined,
      });
      if (!out.ok) return fail(out.error);
      return ok(
        JSON.stringify(
          { metric: out.chartSpec.metricId, title: out.chartSpec.title, measure: out.chartSpec.measureLabel, rows: out.rows },
          null,
          2,
        ),
      );
    }
    case 'todays_games':
      return toolTodaysGames(args);
    case 'player_boxscore':
      return toolPlayerBoxscore(args);
    default:
      return fail(`Unknown tool "${name}".`);
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC / Streamable HTTP plumbing (stateless)

type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };

const rpcError = (id: string | number | null, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });
const rpcResult = (id: string | number | null, result: unknown) => ({ jsonrpc: '2.0', id, result });

async function handleRpc(msg: JsonRpcRequest): Promise<object | null> {
  const id = msg.id ?? null;
  const method = msg.method ?? '';

  // Notifications (no id) get no response body.
  if (msg.id === undefined || method.startsWith('notifications/')) return null;

  switch (method) {
    case 'initialize': {
      const requested = msg.params?.protocolVersion;
      const protocolVersion = PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0];
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS });
    case 'tools/call': {
      const name = msg.params?.name;
      if (typeof name !== 'string') return rpcError(id, -32602, 'Missing tool name.');
      try {
        return rpcResult(id, await callTool(name, msg.params?.arguments ?? {}));
      } catch (err: any) {
        console.error('[mcp] tool failed:', name, err?.message ?? err);
        return rpcResult(id, fail('The tool hit an unexpected error. Please try again.'));
      }
    }
    // Optional capabilities we don't provide — empty lists keep clients happy.
    case 'resources/list':
      return rpcResult(id, { resources: [] });
    case 'prompts/list':
      return rpcResult(id, { prompts: [] });
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Stateless server: no SSE stream to resume, no session to delete.
  if (req.method === 'GET') return res.status(405).json(rpcError(null, -32000, 'This server does not offer a standalone SSE stream. POST JSON-RPC to this URL.'));
  if (req.method === 'DELETE') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json(rpcError(null, -32000, 'Method not allowed.'));

  if (rateLimited(req)) return res.status(429).json(rpcError(null, -32000, 'Rate limit exceeded. Please slow down.'));

  const body = req.body;
  if (!body || typeof body !== 'object') return res.status(400).json(rpcError(null, -32700, 'Parse error: expected a JSON-RPC message.'));

  try {
    // Tolerate old-style batches (arrays) by answering each request in order.
    if (Array.isArray(body)) {
      const responses = (await Promise.all(body.map((m) => handleRpc(m as JsonRpcRequest)))).filter((r): r is object => r !== null);
      if (responses.length === 0) return res.status(202).end();
      return res.status(200).json(responses);
    }
    const response = await handleRpc(body as JsonRpcRequest);
    if (response === null) return res.status(202).end();
    return res.status(200).json(response);
  } catch (err: any) {
    console.error('[mcp] error:', err?.message ?? err);
    return res.status(500).json(rpcError(null, -32603, 'Internal error.'));
  }
}
