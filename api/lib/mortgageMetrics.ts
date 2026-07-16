/**
 * Mortgage Portfolio Intelligence — semantic layer over the Fannie Mae
 * warehouse (schema analytics_mart_mortgage). These are the real, dashboard-grade
 * metrics visitors can chart via "Build a visualization with RyAgent".
 *
 * Every query is authored here and read-only; the model only selects a metricId
 * + chartType (+ optional governed filters). Add a MetricDef to expose a new chart.
 *
 * Two flavors of metric:
 *   - Static SQL (`sql`): fixed monthly/portfolio time series and breakdowns.
 *   - Built SQL (`build`): origination-book breakdowns over dim_loan that accept
 *     governed, parameterized dimension filters (e.g. "purchase loans by state").
 *     Filter columns come from a whitelist and values are always bound parameters,
 *     so this stays injection-safe — the model never writes raw SQL.
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
  chartTypes: ChartType[];
  defaultChart: ChartType;
  example: string;
  usesLimit: boolean;
  /** True for origination-book metrics that accept dimension filters. */
  filterable?: boolean;
  /** Static query (mutually exclusive with `build`). */
  sql?: string;
  /** Dynamic query builder for filterable origination-book metrics. */
  build?: (resolved: ResolvedSpec) => { text: string; params: unknown[] };
};

const S = 'analytics_mart_mortgage';
const LATEST_PORTFOLIO = `(select max(reporting_month) from ${S}.fct_portfolio_monthly)`;
const LATEST_VINTAGE = `(select max(reporting_month) from ${S}.fct_vintage_monthly)`;

/* ------------------------------------------------------------------ */
/* Governed filter dimensions (origination book / dim_loan)           */
/* ------------------------------------------------------------------ */

export type OrigDimension =
  | 'property_state'
  | 'loan_purpose'
  | 'occupancy_status'
  | 'property_type'
  | 'channel'
  | 'origination_year';

type DimensionDef = {
  column: string;
  label: string;
  /** Code -> friendly label for coded columns; absent for free/numeric dims. */
  values?: Record<string, string>;
  numeric?: boolean;
};

export const ORIG_DIMENSIONS: Record<OrigDimension, DimensionDef> = {
  property_state: { column: 'property_state', label: 'Property state' },
  loan_purpose: {
    column: 'loan_purpose',
    label: 'Loan purpose',
    values: { P: 'Purchase', C: 'Cash-out refinance', N: 'Rate/term refinance' },
  },
  occupancy_status: {
    column: 'occupancy_status',
    label: 'Occupancy',
    values: { P: 'Primary residence', I: 'Investment', S: 'Second home' },
  },
  property_type: {
    column: 'property_type',
    label: 'Property type',
    values: { SF: 'Single-family', PU: 'Planned unit dev (PUD)', CO: 'Condo', MH: 'Manufactured housing', CP: 'Co-op' },
  },
  channel: {
    column: 'channel',
    label: 'Origination channel',
    values: { R: 'Retail', C: 'Correspondent', B: 'Broker' },
  },
  origination_year: { column: 'origination_year', label: 'Origination year', numeric: true },
};

// Full US state name -> USPS code, so "California" resolves to CA (values are 2-letter in the data).
const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

export type ResolvedFilter = { dimension: OrigDimension; column: string; value: string; numeric: boolean; label: string };

/** Resolve a raw {dimension,value} to a bound code + display label, or null if invalid. */
function resolveFilter(dimension: string, rawValue: unknown): ResolvedFilter | null {
  if (!(dimension in ORIG_DIMENSIONS)) return null;
  const dim = dimension as OrigDimension;
  const def = ORIG_DIMENSIONS[dim];
  const raw = String(rawValue ?? '').trim();
  if (!raw) return null;

  if (def.numeric) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1900 || n > 2100) return null;
    return { dimension: dim, column: def.column, value: String(n), numeric: true, label: String(n) };
  }

  if (def.values) {
    const upper = raw.toUpperCase();
    for (const [code, label] of Object.entries(def.values)) {
      if (code.toUpperCase() === upper) return { dimension: dim, column: def.column, value: code, numeric: false, label };
    }
    const lower = raw.toLowerCase();
    for (const [code, label] of Object.entries(def.values)) {
      if (label.toLowerCase() === lower || label.toLowerCase().includes(lower)) {
        return { dimension: dim, column: def.column, value: code, numeric: false, label };
      }
    }
    return null;
  }

  // Free-code dimension (state): accept a 2-letter code or a full state name.
  const byName = STATE_NAME_TO_CODE[raw.toLowerCase()];
  const code = byName ?? (raw.length <= 3 ? raw.toUpperCase() : raw);
  return { dimension: dim, column: def.column, value: code, numeric: false, label: code };
}

const MAX_FILTERS = 4;

/* ------------------------------------------------------------------ */
/* Origination-book metric factory (filterable, over dim_loan)        */
/* ------------------------------------------------------------------ */

type OrigConfig = {
  id: string;
  label: string;
  description: string;
  categoryLabel: string;
  measureLabel: string;
  unit: string;
  chartTypes: ChartType[];
  defaultChart: ChartType;
  example: string;
  /** Column grouped by and null-checked. */
  groupCol: string;
  /** SELECT expression for the category label; defaults to groupCol. */
  categoryExpr?: string;
  /** Code->label map (renders a CASE for the category and drives value filtering). */
  values?: Record<string, string>;
  /** SELECT expression for the measure, e.g. 'count(*)::float'. */
  measureExpr: string;
  /** Extra "is not null" guard for avg() measures. */
  measureCol?: string;
  order: 'value_desc' | 'category_asc';
  usesLimit?: boolean;
};

function caseExpr(col: string, values: Record<string, string>): string {
  const whens = Object.entries(values)
    .map(([code, label]) => `when '${code}' then '${label.replace(/'/g, "''")}'`)
    .join(' ');
  return `case ${col} ${whens} else ${col} end`;
}

function origMetric(cfg: OrigConfig): MortgageMetric {
  const categoryExpr = cfg.categoryExpr ?? (cfg.values ? caseExpr(cfg.groupCol, cfg.values) : cfg.groupCol);
  return {
    id: cfg.id,
    label: cfg.label,
    description: cfg.description,
    kind: 'breakdown',
    categoryLabel: cfg.categoryLabel,
    measureLabel: cfg.measureLabel,
    unit: cfg.unit,
    chartTypes: cfg.chartTypes,
    defaultChart: cfg.defaultChart,
    example: cfg.example,
    usesLimit: !!cfg.usesLimit,
    filterable: true,
    build: (resolved) => {
      const params: unknown[] = [];
      const wheres = [`${cfg.groupCol} is not null`];
      if (cfg.measureCol) wheres.push(`${cfg.measureCol} is not null`);
      for (const f of resolved.filters) {
        params.push(f.value);
        wheres.push(`${f.column} = $${params.length}${f.numeric ? '::int' : ''}`);
      }
      let text =
        `select ${categoryExpr} as category, ${cfg.measureExpr} as value ` +
        `from ${S}.dim_loan where ${wheres.join(' and ')} ` +
        `group by ${cfg.groupCol} order by ${cfg.order === 'value_desc' ? 'value desc' : cfg.groupCol}`;
      if (cfg.usesLimit) {
        params.push(resolved.limit);
        text += ` limit $${params.length}`;
      }
      return { text, params };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Metric catalog                                                     */
/* ------------------------------------------------------------------ */

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

  // --- origination-book breakdowns (dim_loan) — all filterable by dimension ---
  origMetric({
    id: 'loans_by_state',
    label: 'Loans by property state',
    description: 'Count of loans by property state (top states). Filterable by purpose, occupancy, property type, channel, or year.',
    categoryLabel: 'State',
    measureLabel: 'Loans',
    unit: '',
    chartTypes: ['bar', 'horizontalBar'],
    defaultChart: 'bar',
    example: 'Which states have the most loans?',
    groupCol: 'property_state',
    measureExpr: 'count(*)::float',
    order: 'value_desc',
    usesLimit: true,
  }),
  origMetric({
    id: 'loans_by_purpose',
    label: 'Loans by purpose',
    description: 'Count of loans by loan purpose (purchase, cash-out refi, rate/term refi).',
    categoryLabel: 'Loan purpose',
    measureLabel: 'Loans',
    unit: '',
    chartTypes: ['pie', 'bar', 'horizontalBar'],
    defaultChart: 'pie',
    example: 'Break down loans by purpose',
    groupCol: 'loan_purpose',
    values: ORIG_DIMENSIONS.loan_purpose.values,
    measureExpr: 'count(*)::float',
    order: 'value_desc',
  }),
  origMetric({
    id: 'loans_by_occupancy',
    label: 'Loans by occupancy',
    description: 'Count of loans by occupancy type (primary residence, investment, second home).',
    categoryLabel: 'Occupancy',
    measureLabel: 'Loans',
    unit: '',
    chartTypes: ['pie', 'bar', 'horizontalBar'],
    defaultChart: 'pie',
    example: 'Break down loans by occupancy type',
    groupCol: 'occupancy_status',
    values: ORIG_DIMENSIONS.occupancy_status.values,
    measureExpr: 'count(*)::float',
    order: 'value_desc',
  }),
  origMetric({
    id: 'loans_by_property_type',
    label: 'Loans by property type',
    description: 'Count of loans by property type (single-family, PUD, condo, etc.).',
    categoryLabel: 'Property type',
    measureLabel: 'Loans',
    unit: '',
    chartTypes: ['bar', 'horizontalBar', 'pie'],
    defaultChart: 'bar',
    example: 'Break down loans by property type',
    groupCol: 'property_type',
    values: ORIG_DIMENSIONS.property_type.values,
    measureExpr: 'count(*)::float',
    order: 'value_desc',
  }),
  origMetric({
    id: 'loans_by_channel',
    label: 'Loans by origination channel',
    description: 'Count of loans by origination channel (retail, correspondent, broker).',
    categoryLabel: 'Origination channel',
    measureLabel: 'Loans',
    unit: '',
    chartTypes: ['pie', 'bar', 'horizontalBar'],
    defaultChart: 'pie',
    example: 'Break down loans by origination channel',
    groupCol: 'channel',
    values: ORIG_DIMENSIONS.channel.values,
    measureExpr: 'count(*)::float',
    order: 'value_desc',
  }),
  origMetric({
    id: 'originations_by_year',
    label: 'Originations by year',
    description: 'Count of loans originated per origination year. Filterable by state, purpose, occupancy, etc.',
    categoryLabel: 'Origination year',
    measureLabel: 'Loans originated',
    unit: '',
    chartTypes: ['bar', 'area', 'line'],
    defaultChart: 'bar',
    example: 'How many loans were originated each year?',
    groupCol: 'origination_year',
    categoryExpr: 'origination_year::text',
    measureExpr: 'count(*)::float',
    order: 'category_asc',
  }),
  origMetric({
    id: 'avg_credit_score_by_vintage',
    label: 'Average credit score by origination year',
    description: 'Average borrower credit score at origination, by origination year.',
    categoryLabel: 'Origination year',
    measureLabel: 'Avg credit score',
    unit: '',
    chartTypes: ['line', 'area', 'bar'],
    defaultChart: 'line',
    example: 'How does average credit score vary by origination year?',
    groupCol: 'origination_year',
    categoryExpr: 'origination_year::text',
    measureExpr: 'round(avg(credit_score))::float',
    measureCol: 'credit_score',
    order: 'category_asc',
  }),
  origMetric({
    id: 'avg_ltv_by_year',
    label: 'Average original LTV by origination year',
    description: 'Average original loan-to-value ratio at origination, by year.',
    categoryLabel: 'Origination year',
    measureLabel: 'Avg original LTV',
    unit: '%',
    chartTypes: ['line', 'area', 'bar'],
    defaultChart: 'line',
    example: 'How has average LTV changed over origination years?',
    groupCol: 'origination_year',
    categoryExpr: 'origination_year::text',
    measureExpr: 'round(avg(original_ltv), 1)::float',
    measureCol: 'original_ltv',
    order: 'category_asc',
  }),
  origMetric({
    id: 'avg_dti_by_year',
    label: 'Average original DTI by origination year',
    description: 'Average original debt-to-income ratio at origination, by year.',
    categoryLabel: 'Origination year',
    measureLabel: 'Avg original DTI',
    unit: '%',
    chartTypes: ['line', 'area', 'bar'],
    defaultChart: 'line',
    example: 'How has average DTI changed over origination years?',
    groupCol: 'origination_year',
    categoryExpr: 'origination_year::text',
    measureExpr: 'round(avg(original_dti), 1)::float',
    measureCol: 'original_dti',
    order: 'category_asc',
  }),
  origMetric({
    id: 'avg_rate_by_year',
    label: 'Average note rate by origination year',
    description: 'Average original interest rate at origination, by year.',
    categoryLabel: 'Origination year',
    measureLabel: 'Avg note rate',
    unit: '%',
    chartTypes: ['line', 'area', 'bar'],
    defaultChart: 'line',
    example: 'How has the average note rate changed over origination years?',
    groupCol: 'origination_year',
    categoryExpr: 'origination_year::text',
    measureExpr: 'round(avg(original_interest_rate), 2)::float',
    measureCol: 'original_interest_rate',
    order: 'category_asc',
  }),
];

const BY_ID = new Map(MORTGAGE_METRICS.map((m) => [m.id, m]));

/**
 * Per-metric "take it further" suggestions surfaced under a rendered chart.
 * `hint` is a smart one-liner; each followUp is a plain-English prompt the
 * visitor can tap — it's sent to RyAgent, which reshapes the chart live via the
 * excludeCategories / includeCategories / sort / limit / filters transforms.
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
    hint: 'This shows the largest states — narrow it, filter it, or flip the layout:',
    followUps: ['Just the top 5 states', 'Show it for purchase loans only', 'Show it for investment properties only', 'Show it as a horizontal bar chart'],
  },
  loans_by_purpose: {
    followUps: ['Draw it as a bar chart', 'Show it for California only', 'Sort purposes from largest to smallest'],
  },
  loans_by_occupancy: {
    followUps: ['Draw it as a bar chart', 'Show it for purchase loans only', 'Show it as a horizontal bar chart'],
  },
  loans_by_property_type: {
    followUps: ['Show it for investment properties only', 'Draw it as a pie chart', 'Show it for Texas only'],
  },
  loans_by_channel: {
    followUps: ['Draw it as a bar chart', 'Show it for cash-out refinances only', 'Show it for California only'],
  },
  originations_by_year: {
    followUps: ['Show it for California only', 'Show it for purchase loans only', 'Draw it as a line chart'],
  },
  avg_credit_score_by_vintage: {
    followUps: ['Draw it as a bar chart', 'Show it for investment properties only', 'Show it for California only'],
  },
  avg_ltv_by_year: {
    followUps: ['Show it for purchase loans only', 'Show it for investment properties only', 'Draw it as a bar chart'],
  },
  avg_dti_by_year: {
    followUps: ['Show it for cash-out refinances only', 'Show it for California only', 'Draw it as a bar chart'],
  },
  avg_rate_by_year: {
    followUps: ['Show it for purchase loans only', 'Show it for California only', 'Draw it as a bar chart'],
  },
};

export function getMortgageMetric(id: string): MortgageMetric | undefined {
  return BY_ID.get(id);
}

/** Public catalog of filter dimensions for the UI/agent (codes + friendly labels). */
export function listDimensions() {
  return (Object.entries(ORIG_DIMENSIONS) as [OrigDimension, DimensionDef][]).map(([key, def]) => ({
    key,
    label: def.label,
    numeric: !!def.numeric,
    values: def.values ? Object.entries(def.values).map(([code, label]) => ({ code, label })) : null,
  }));
}

export function listMortgageMetrics() {
  return MORTGAGE_METRICS.map(({ sql, build, ...rest }) => ({
    ...rest,
    filterable: !!rest.filterable,
    hint: METRIC_REFINEMENTS[rest.id]?.hint,
    followUps: METRIC_REFINEMENTS[rest.id]?.followUps ?? [],
  }));
}

export type SortOrder = 'asc' | 'desc';

export type FilterInput = { dimension: string; value: string };

/** Named accent colors a chart can use (mirrors NAMED_COLORS on the client). */
export const CHART_COLORS = [
  'cyan', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink',
  'red', 'orange', 'amber', 'green', 'emerald', 'teal', 'lime', 'slate',
];

/** Accept a known color name or a #rrggbb hex; otherwise undefined (use default). */
function resolveColor(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim().toLowerCase();
  if (CHART_COLORS.includes(s)) return s;
  if (/^#[0-9a-f]{6}$/i.test(raw.trim())) return raw.trim();
  return undefined;
}

export type VizSpec = {
  metricId: string;
  chartType?: ChartType;
  limit?: number;
  excludeCategories?: string[];
  includeCategories?: string[];
  sort?: SortOrder;
  filters?: FilterInput[];
  color?: string;
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
  /** Governed, validated dimension filters (origination-book metrics only). */
  filters: ResolvedFilter[];
  /** Validated accent color (name or #hex), or undefined for the default. */
  color?: string;
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
  const chartType = spec.chartType && metric.chartTypes.includes(spec.chartType) ? spec.chartType : metric.defaultChart;
  const limitProvided = typeof spec.limit === 'number' && Number.isFinite(spec.limit);
  let limit = limitProvided ? Math.round(spec.limit as number) : DEFAULT_LIMIT;
  limit = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
  // topN is a post-query cap that only applies when the caller explicitly asked
  // for one — so we never silently truncate an ordered series (e.g. vintages).
  const topN = limitProvided ? limit : undefined;
  const excludeCategories = normalizeKeywords(spec.excludeCategories);
  const includeCategories = normalizeKeywords(spec.includeCategories);
  const sort = spec.sort === 'asc' || spec.sort === 'desc' ? spec.sort : undefined;

  // Filters only apply to filterable (origination-book) metrics; silently
  // dropped for others so an out-of-scope ask degrades instead of erroring.
  const filters: ResolvedFilter[] = [];
  if (metric.filterable && Array.isArray(spec.filters)) {
    for (const f of spec.filters.slice(0, MAX_FILTERS)) {
      if (!f || typeof f.dimension !== 'string') continue;
      const resolved = resolveFilter(f.dimension, f.value);
      if (resolved) filters.push(resolved);
    }
  }

  const color = resolveColor(spec.color);

  return { ok: true, resolved: { metric, chartType, limit, topN, excludeCategories, includeCategories, sort, filters, color } };
}
