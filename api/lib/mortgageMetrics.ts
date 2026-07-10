/**
 * Mortgage Portfolio Intelligence — semantic layer over the Fannie Mae
 * warehouse (schema analytics_mart_mortgage). These are the real, dashboard-grade
 * metrics visitors can chart via "Build a visualization with RyAgent".
 *
 * Every query is authored here and read-only; the model only selects a metricId
 * + chartType. Add a MetricDef to expose a new chart — nothing else changes.
 */

export type ChartType = 'line' | 'bar' | 'pie';

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
    chartTypes: ['line', 'bar'],
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
    chartTypes: ['line', 'bar'],
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
    chartTypes: ['line', 'bar'],
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
    chartTypes: ['line', 'bar'],
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
    chartTypes: ['line', 'bar'],
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
    chartTypes: ['bar', 'pie'],
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
    chartTypes: ['bar', 'pie'],
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
    chartTypes: ['bar', 'line'],
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
    chartTypes: ['bar'],
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
    chartTypes: ['pie', 'bar'],
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
    chartTypes: ['line', 'bar'],
    defaultChart: 'line',
    example: 'How does average credit score vary by origination year?',
    usesLimit: false,
    sql: `select origination_year::text as category, round(avg(credit_score))::float as value
          from ${S}.dim_loan where credit_score is not null and origination_year is not null
          group by origination_year order by origination_year`,
  },
];

const BY_ID = new Map(MORTGAGE_METRICS.map((m) => [m.id, m]));

export function getMortgageMetric(id: string): MortgageMetric | undefined {
  return BY_ID.get(id);
}

export function listMortgageMetrics() {
  return MORTGAGE_METRICS.map(({ sql, ...rest }) => rest);
}

export type VizSpec = { metricId: string; chartType?: ChartType; limit?: number };
export type ResolvedSpec = { metric: MortgageMetric; chartType: ChartType; limit: number };

export const DEFAULT_LIMIT = 10;
const MIN_LIMIT = 3;
const MAX_LIMIT = 25;

export function resolveSpec(spec: VizSpec): { ok: true; resolved: ResolvedSpec } | { ok: false; error: string } {
  const metric = getMortgageMetric(spec.metricId);
  if (!metric) {
    return { ok: false, error: `Unknown metric "${spec.metricId}". Valid: ${MORTGAGE_METRICS.map((m) => m.id).join(', ')}.` };
  }
  let chartType = spec.chartType && metric.chartTypes.includes(spec.chartType) ? spec.chartType : metric.defaultChart;
  let limit = typeof spec.limit === 'number' && Number.isFinite(spec.limit) ? Math.round(spec.limit) : DEFAULT_LIMIT;
  limit = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
  return { ok: true, resolved: { metric, chartType, limit } };
}
