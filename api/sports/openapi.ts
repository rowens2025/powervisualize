import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SPORTS_METRICS, SPORTS_DIMENSIONS, SPORTS_CHART_TYPES } from '../_lib/sportsMetrics.js';

/**
 * OpenAPI 3.1 description of the MLB sports semantic-layer API, generated from
 * the semantic layer so it never drifts. Rendered by /api/sports/docs (Scalar).
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const metricIds = SPORTS_METRICS.map((m) => m.id);
  const metricDocs = SPORTS_METRICS.map((m) => `\`${m.id}\` — ${m.description} (dims: ${m.dimensions.join(', ')}${m.requiresTeam ? ', team required' : ''})`).join('\n\n');
  const dimDocs = (Object.entries(SPORTS_DIMENSIONS) as [string, { label: string; description: string }][])
    .map(([k, d]) => `\`${k}\` — ${d.description}`)
    .join('\n\n');

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'MLB Sports Semantic Layer API',
      version: '1.0.0',
      description:
        'A governed, Cube-style semantic layer over an MLB warehouse. Daily game scores are pulled from ESPN, ' +
        'modeled with dbt into `analytics` marts (dim_team, fct_team_game, mart_team_season), and exposed as a ' +
        'small set of curated metrics. Callers (including AI agents) pick a metric + whitelisted filters — never raw SQL.\n\n' +
        'The same layer is also served over **MCP** at `/api/mcp` (Streamable HTTP) — add it to Claude as a custom ' +
        'connector for warehouse metrics plus live player box scores.\n\n' +
        `### Metrics\n\n${metricDocs}\n\n### Dimensions\n\n${dimDocs}`,
    },
    servers: [{ url: '/', description: 'This deployment' }],
    tags: [{ name: 'sports', description: 'MLB team performance' }],
    paths: {
      '/api/sports/meta': {
        get: {
          tags: ['sports'],
          summary: 'Describe the semantic layer',
          description: 'Plain-English catalog of every metric, dimension, and the query format. Read this first — it teaches you how to query.',
          responses: {
            '200': { description: 'The semantic layer definition', content: { 'application/json': { schema: { $ref: '#/components/schemas/Meta' } } } },
          },
        },
      },
      '/api/sports/query': {
        post: {
          tags: ['sports'],
          summary: 'Run one governed query',
          description: 'Resolve a metric + optional filters against the semantic layer and return a chart spec plus rows. Only `metric` is required.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SportsQuery' },
                examples: {
                  runDifferential: { summary: 'Top run differentials', value: { metric: 'run_diff_by_team', limit: 8, sort: 'desc' } },
                  oneTeamTrend: { summary: 'A team’s cumulative wins', value: { metric: 'team_cumulative_wins', team: 'LAD' } },
                  offenseByTeam: { summary: 'Runs scored, top 10', value: { metric: 'runs_scored_by_team' } },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Chart spec and data rows', content: { 'application/json': { schema: { $ref: '#/components/schemas/QueryResult' } } } },
            '400': { description: 'Invalid query', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
    },
    components: {
      schemas: {
        SportsQuery: {
          type: 'object',
          required: ['metric'],
          properties: {
            metric: { type: 'string', enum: metricIds, description: 'Which metric to compute.' },
            season: { type: 'integer', description: 'Season year. Defaults to the latest.' },
            team: { type: 'string', description: '2–3 letter team code (e.g. LAD). Filters to one team; required for team_cumulative_wins.' },
            sort: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order for breakdowns.' },
            limit: { type: 'integer', minimum: 3, maximum: 30, description: 'Top-N teams (breakdowns).' },
            chartType: { type: 'string', enum: [...SPORTS_CHART_TYPES], description: 'Must be one the metric allows.' },
          },
        },
        ChartSpec: {
          type: 'object',
          properties: {
            metricId: { type: 'string' },
            title: { type: 'string' },
            chartType: { type: 'string', enum: [...SPORTS_CHART_TYPES] },
            kind: { type: 'string', enum: ['breakdown', 'trend'] },
            categoryLabel: { type: 'string' },
            measureLabel: { type: 'string' },
            unit: { type: 'string' },
            description: { type: 'string' },
          },
        },
        Row: {
          type: 'object',
          properties: { category: { type: 'string' }, value: { type: 'number' } },
        },
        QueryResult: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            chartSpec: { $ref: '#/components/schemas/ChartSpec' },
            rows: { type: 'array', items: { $ref: '#/components/schemas/Row' } },
          },
        },
        Meta: {
          type: 'object',
          properties: {
            dataset: { type: 'string' },
            grain: { type: 'string' },
            metrics: { type: 'array', items: { type: 'object' } },
            dimensions: { type: 'array', items: { type: 'object' } },
            queryFormat: { type: 'object' },
          },
        },
        Error: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).send(JSON.stringify(spec));
}
