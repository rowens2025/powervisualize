/**
 * Mortgage Portfolio Intelligence — semantic layer over the Fannie Mae
 * warehouse (schema analytics_mart_mortgage). These are the real, dashboard-grade
 * metrics visitors can chart via "Build a visualization with RyAgent".
 *
 * Every query is authored here and read-only; the model only selects a metricId
 * + chartType. Add a MetricDef to expose a new chart — nothing else changes.
 */

export type ChartType = 'line' | 'area' | 'bar' | 'horizontalBar' | 'pie';

export type MetricKind = 'trend' | 'breakdown';

export type MortgageMetric = {
  id: string;
  label: string;
  description: string;
  kind: MetricKind;
  categoryLabel: string;
  measureLabel: string;
  /** Display suffix, e.g. '%' | ' loans' | ''. */
  unit: string;
  /** For $ values, divide raw by this before display (e.g. 1e9 -> billions). */
  chartTypes: ChartType[];
  defaultChart: ChartType;
  example: string;
  usesLimit: boolean;
  sql: string;
};

const S = 'analytics_mart_mortgage';
const LATEST_PORTFOLIO = `(select max(reporting_month) from ${S}.fct_portfolio_monthly)`;
const LATEST_VINTAGE = `(select max(reporting_month) from ${S}.fct_vintage_monthly)`;

export const MORTGAGE_METRICS: MortgageMetric[] = [
  // --- monthly KPI trends (fct_portfolio_monthly_kpis, 2020-01..) ---
  {
    id: 'delinquency_rate_30_plus_trend',
    label: '30+ day delinquency rate over time',
    description: 'Share of active loans that are 30+ days delinquent, by month.',
    kind: 'trend',
    categoryLabel: 'Month',
    measureLabel: 'Delinquency rate',
    unit: '%',
    chartTypes: ['line', 'area', 'bar'],
    defaultChart: 'line',
    example: 'Show the 30+ day delinquency rate trend',
    usesLimit: false,
    sql: `select to_char(reporting_month,'YYYY-MM') as category, round(delinquency_rate_30_plus*100,3)::float as value
          from ${S}.fct_portfolio_monthly_kpis order by reporting_month`,
  },
  {
    id: 'delinquency_upb_rate_trend',
    label: '30+ delinquency rate by UPB over time',
    description: 'Delinquent unpaid balance (30+) as a share of active UPB, by month.',
    kind: 'trend',
    categoryLabel: 'Month',
    measureLabel: 'Delinquent UPB rate',
    unit: '%',
    chartTypes: ['line', 'area', 'bar'],
    defaultChart: 'line',
    example: 'Delinquency rate weighted by balance over time',
    usesLimit: false,
    sql: `select to_char(reporting_month,'YYYY-MM') as category, round(delinquency_upb_rate_30_plus*100,3)::float as value
          from ${S}.fct_portfolio_monthly_kpis order by reporting_month`,
  },
  {
    id: 'active_loan_count_trend',
    label: 'Active loan count over time',
    description: 'Total active loans (excludes zero-balance) by month.',
    kind: 'trend',
    categoryLabel: 'Month',
    measureLabel: 'Active loans',
    unit: '',
    chartTypes: ['line', 'area', 'bar'],
    defaultChart: 'line',
    example: 'How has the active loan count changed over time?',
    usesLimit: false,
    sql: `select to_char(reporting_month,'YYYY-MM') as category, active_loan_count::float as value
          from ${S}.fct_portfolio_monthly_kpis order by reporting_month`,
  },
  {
    id: 'active_upb_trend',
    label: 'Active UPB over time ($B)',
    description: 'Total active unpaid principal balance, in billions of dollars, by month.',
    kind: 'trend',
    categoryLabel: 'Month',
    measureLabel: 'Active UPB',
    unit: '$B',
    chartTypes: ['line', 'area', 'bar'],
    defaultChart: 'line',
    example: 'Show total active UPB over time',
    usesLimit: false,
    sql: `select to_char(reporting_month,'YYYY-MM') as category, round((active_upb/1e9)::numeric,1)::float as value
          from ${S}.fct_portfolio_monthly_kpis order by reporting_month`,
  },
  {
    id: 'delinq_loan_count_trend',
    label: '30+ delinquent loan count over time',
    description: 'Number of loans 30+ days delinquent, by month.',
    kind: 'trend',
    categoryLabel: 'Month',
    measureLabel: 'Delinquent loans (30+)',
    unit: '',
    chartTypes: ['line', 'area', 'bar'],
    defaultChart: 'line',
    example: 'Trend of loans that are 30+ days delinquent',
    usesLimit: false,
    sql: `select to_char(reporting_month,'YYYY-MM') as category, delinq_30plus_loan_count::float as value
          from ${S}.fct_portfolio_monthly_kpis order by reporting_month`,
  },

  // --- latest-month breakdowns ---
  {
    id: 'portfolio_by_delinquency_bucket',
    label: 'Portfolio by delinquency bucket (latest month)',
    description: 'Loan count split across delinquency buckets in the most recent reporting month.',
    kind: 'breakdown',
    categoryLabel: 'Delinquency bucket',
    measureLabel: 'Loans',
    unit: '',
    chartTypes: ['bar', 'horizontalBar', 'pie'],
    defaultChart: 'bar',
    example: 'Break down the portfolio by delinquency status',
    usesLimit: false,
    sql: `select b.delinquency_bucket_description as category, m.distinct_loan_count::float as value
          from ${S}.fct_portfolio_monthly m
          join ${S}.dim_delinquency_bucket b on b.delinquency_bucket = m.delinquency_bucket
          where m.reporting_month = ${LATEST_PORTFOLIO}
          order by b.delinquency_bucket_order`,
  },
  {
    id: 'upb_by_delinquency_bucket',
    label: 'UPB by delinquency bucket (latest month, $B)',
    description: 'Unpaid balance ($B) split across delinquency buckets in the most recent month.',
    kind: 'breakdown',
    categoryLabel: 'Delinquency bucket',
    measureLabel: 'UPB',
    unit: '$B',
    chartTypes: ['bar', 'horizontalBar', 'pie'],
    defaultChart: 'bar',
    example: 'Show unpaid balance by delinquency bucket',
    usesLimit: false,
    sql: `select b.delinquency_bucket_description as category, round((m.total_current_actual_upb/1e9)::numeric,2)::float as value
          from ${S}.fct_portfolio_monthly m
          join ${S}.dim_delinquency_bucket b on b.delinquency_bucket = m.delinquency_bucket
          where m.reporting_month = ${LATEST_PORTFOLIO}
          order by b.delinquency_bucket_order`,
  },
  {
    id: 'delinquency_rate_by_vintage',
    label: '30+ delinquency rate by vintage year (latest month)',
    description: 'Current 30+ delinquency rate broken out by loan origination (vintage) year.',
    kind: 'breakdown',
    categoryLabel: 'Vintage year',
    measureLabel: 'Delinquency rate',
    unit: '%',
    chartTypes: ['bar', 'horizontalBar', 'line'],
    defaultChart: 'bar',
    example: 'Which vintage years have the highest delinquency?',
    usesLimit: false,
    sql: `select vintage_year::text as category,
            round((sum(delinq_30plus_loan_records)::numeric / nullif(sum(active_loan_records), 0)) * 100, 3)::float as value
          from ${S}.fct_vintage_monthly
          where reporting_month = ${LATEST_VINTAGE} and vintage_year is not null
          group by vintage_year
          order by vintage_year`,
  },

  // --- origination-book (dim_loan) breakdowns ---
  {
    id: 'loans_by_state',
    label: 'Loans by property state',
    description: 'Count of loans by property state (top states).',
    kind: 'breakdown',
    categoryLabel: 'State',
    measureLabel: 'Loans',
    unit: '',
    chartTypes: ['bar', 'horizontalBar'],
    defaultChart: 'bar',
    example: 'Which states have the most loans?',
    usesLimit: true,
    sql: `select property_state as category, count(*)::float as value
          from ${S}.dim_loan where property_state is not null
          group by property_state order by value desc limit $1`,
  },
  {
    id: 'loans_by_purpose',
    label: 'Loans by purpose',
    description: 'Count of loans by loan purpose (purchase, refinance, etc.).',
    kind: 'breakdown',
    categoryLabel: 'Loan purpose',
    measureLabel: 'Loans',
    unit: '',
    chartTypes: ['pie', 'bar', 'horizontalBar'],
    defaultChart: 'pie',
    example: 'Break down loans by purpose',
    usesLimit: false,
    sql: `select case loan_purpose
              when 'P' then 'Purchase'
              when 'C' then 'Cash-out refinance'
              when 'N' then 'Rate/term refinance'
              when 'R' then 'Refinance'
              else loan_purpose end as category,
            count(*)::float as value
          from ${S}.dim_loan where loan_purpose is not null
          group by loan_purpose order by value desc`,
  },
  {
    id: 'avg_credit_score_by_vintage',
    label: 'Average credit score by origination year',
    description: 'Average borrower credit score at origination, by origination year.',
    kind: 'breakdown',
    categoryLabel: 'Origination year',
    measureLabel: 'Avg credit score',
    unit: '',
    chartTypes: ['line', 'area', 'bar'],
    defaultChart: 'line',
    example: 'How does average credit score vary by origination year?',
    usesLimit: false,
    sql: `select origination_year::text as category, round(avg(credit_score))::float as value
          from ${S}.dim_loan where credit_score is not null and origination_year is not null
          group by origination_year order by origination_year`,
  },
];

const BY_ID = new Map(MORTGAGE_METRICS.map((m) => [m.id, m]));

/**
 * Per-metric "take it further" suggestions surfaced under a rendered chart.
 * `hint` is a smart one-liner; each followUp is a plain-English prompt the
 * visitor can tap — it's sent to RyAgent, which reshapes the chart live via the
 * excludeCategories / includeCategories / sort / limit transforms. Phrased to
 * name the chart explicitly so the agent always maps to the right metric.
 */
type MetricRefinement = { hint?: string; followUps: string[] };

const METRIC_REFINEMENTS: Record<string, MetricRefinement> = {
  delinquency_rate_30_plus_trend: {
    followUps: ['Draw it as a filled area chart', 'Break delinquency down by vintage year instead', 'Weight the delinquency rate by loan balance (UPB) instead'],
  },
  delinquency_upb_rate_trend: {
    followUps: ['Draw it as a bar chart', 'Compare it to the loan-count delinquency rate'],
  },
  active_loan_count_trend: {
    followUps: ['Draw it as a bar chart', 'Show active UPB over time instead', 'Show the 30+ delinquent loan count instead'],
  },
  active_upb_trend: {
    followUps: ['Draw it as a filled area chart', 'Show the active loan count over time instead'],
  },
  delinq_loan_count_trend: {
    followUps: ['Draw it as a bar chart', 'Show the delinquency rate instead of the raw count'],
  },
  portfolio_by_delinquency_bucket: {
    hint: "Heads up — the “current” bucket is so large it flattens everything else. That's exactly what these refinements fix:",
    followUps: [
      'Drop the “current” bucket so the delinquent tail is readable',
      'Show only the 30-59, 60-89, and 90+ delinquent buckets',
      'Sort the buckets from largest to smallest',
      'Show it as a pie chart',
    ],
  },
  upb_by_delinquency_bucket: {
    hint: 'The “current” balance dominates the mix — try zeroing in on the delinquent share:',
    followUps: [
      'Drop the “current” bucket to see the delinquent balance',
      'Show only the delinquent buckets (30+)',
      'Sort by balance, largest first',
    ],
  },
  delinquency_rate_by_vintage: {
    hint: 'Zero in on the riskiest cohorts:',
    followUps: ['Show only the 5 worst vintage years', 'Sort vintages from highest delinquency to lowest', 'Draw it as a line chart'],
  },
  loans_by_state: {
    hint: 'This shows the largest states — narrow it, widen it, or flip the layout:',
    followUps: ['Just the top 5 states', 'Show the top 15 states', 'Show it as a horizontal bar chart'],
  },
  loans_by_purpose: {
    followUps: ['Draw it as a bar chart', 'Drop the smallest purpose category', 'Sort purposes from largest to smallest'],
  },
  avg_credit_score_by_vintage: {
    followUps: ['Draw it as a bar chart', 'Show only the last 5 origination years', 'Sort by average credit score'],
  },
};

export function getMortgageMetric(id: string): MortgageMetric | undefined {
  return BY_ID.get(id);
}

export function listMortgageMetrics() {
  return MORTGAGE_METRICS.map(({ sql, ...rest }) => ({
    ...rest,
    hint: METRIC_REFINEMENTS[rest.id]?.hint,
    followUps: METRIC_REFINEMENTS[rest.id]?.followUps ?? [],
  }));
}

export type SortOrder = 'asc' | 'desc';

export type VizSpec = {
  metricId: string;
  chartType?: ChartType;
  limit?: number;
  excludeCategories?: string[];
  includeCategories?: string[];
  sort?: SortOrder;
};
export type ResolvedSpec = {
  metric: MortgageMetric;
  chartType: ChartType;
  limit: number;
  /** Post-query cap on category count, only when the caller asked (breakdowns). */
  topN?: number;
  excludeCategories: string[];
  includeCategories: string[];
  sort?: SortOrder;
};

const MAX_KEYWORDS = 12;

/** Normalize a caller-supplied keyword list to lowercase, deduped, capped terms. */
function normalizeKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const terms = raw
    .filter((c): c is string => typeof c === 'string')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
  return Array.from(new Set(terms)).slice(0, MAX_KEYWORDS);
}

export const DEFAULT_LIMIT = 10;
const MIN_LIMIT = 3;
const MAX_LIMIT = 25;

export function resolveSpec(spec: VizSpec): { ok: true; resolved: ResolvedSpec } | { ok: false; error: string } {
  const metric = getMortgageMetric(spec.metricId);
  if (!metric) {
    return { ok: false, error: `Unknown metric "${spec.metricId}". Valid: ${MORTGAGE_METRICS.map((m) => m.id).join(', ')}.` };
  }
  let chartType = spec.chartType && metric.chartTypes.includes(spec.chartType) ? spec.chartType : metric.defaultChart;
  const limitProvided = typeof spec.limit === 'number' && Number.isFinite(spec.limit);
  let limit = limitProvided ? Math.round(spec.limit as number) : DEFAULT_LIMIT;
  limit = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
  // topN is a post-query cap that only applies when the caller explicitly asked
  // for one — so we never silently truncate an ordered series (e.g. vintages).
  const topN = limitProvided ? limit : undefined;
  const excludeCategories = normalizeKeywords(spec.excludeCategories);
  const includeCategories = normalizeKeywords(spec.includeCategories);
  const sort = spec.sort === 'asc' || spec.sort === 'desc' ? spec.sort : undefined;
  return { ok: true, resolved: { metric, chartType, limit, topN, excludeCategories, includeCategories, sort } };
}
