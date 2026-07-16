import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export type ChartType = 'line' | 'area' | 'bar' | 'horizontalBar' | 'pie';

export type ChartSpec = {
  metricId: string;
  title: string;
  chartType: ChartType;
  kind: 'trend' | 'breakdown';
  categoryLabel: string;
  measureLabel: string;
  unit: string;
  description: string;
  /** Optional accent color (named, e.g. "red", or a #hex). Defaults to cyan. */
  color?: string;
  /** Optional fill opacity 0.1–1 (area/bar/pie). */
  opacity?: number;
};

export type ChartRow = { category: string; value: number };

/** Named accents the builder + color picker can choose from. */
export const NAMED_COLORS: Record<string, string> = {
  cyan: '#22d3ee',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  lime: '#84cc16',
  slate: '#94a3b8',
};

const DEFAULT_ACCENT = '#22d3ee';
// Multi-category default palette (used when no explicit color is chosen).
const PALETTE = ['#22d3ee', '#a855f7', '#f472b6', '#38bdf8', '#818cf8', '#2dd4bf', '#fb923c', '#f43f5e'];

/** Resolve a spec color (name or #hex) to a hex string, or null for the default. */
function resolveColor(color?: string): string | null {
  if (!color) return null;
  const c = color.trim().toLowerCase();
  if (NAMED_COLORS[c]) return NAMED_COLORS[c];
  if (/^#[0-9a-f]{6}$/i.test(color.trim())) return color.trim();
  return null;
}

function fmt(v: number, unit: string): string {
  if (unit === '%') return `${v}%`;
  if (unit === '$B') return `$${v.toLocaleString()}B`;
  return v.toLocaleString();
}

export default function RyAgentChart({ spec, rows }: { spec: ChartSpec; rows: ChartRow[] }) {
  if (!rows || rows.length === 0) {
    return <p className="text-xs text-slate-400">No data returned for this metric.</p>;
  }

  const tickInterval = spec.kind === 'trend' ? Math.max(0, Math.floor(rows.length / 6)) : 0;
  const accent = resolveColor(spec.color) ?? DEFAULT_ACCENT;
  const hasCustomColor = resolveColor(spec.color) !== null;
  // Unique gradient id per tile so multiple area charts don't share one <defs>.
  const gradId = `rya_${(spec.metricId || 'x').replace(/[^a-z0-9_]/gi, '')}_${accent.replace('#', '')}`;

  // Optional user-set fill opacity (area/bar/pie). Undefined = per-chart default.
  const userOpacity = typeof spec.opacity === 'number' ? Math.max(0.1, Math.min(1, spec.opacity)) : null;

  // Per-category cell color: a chosen accent renders as monochrome shades
  // (via opacity) so pies/bars stay readable; otherwise use the default palette.
  const cellFill = (i: number): { fill: string; fillOpacity: number } => {
    if (hasCustomColor) {
      const step = rows.length > 1 ? (i / (rows.length - 1)) * 0.55 : 0;
      return { fill: accent, fillOpacity: userOpacity ?? Math.max(0.4, 0.95 - step) };
    }
    return { fill: PALETTE[i % PALETTE.length], fillOpacity: userOpacity ?? 1 };
  };
  // Area gradient peak opacity honors a user-set opacity when present.
  const areaTop = userOpacity ?? 0.45;

  const tooltipStyle = {
    contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
    labelStyle: { color: '#e2e8f0' },
    itemStyle: { color: accent },
    formatter: (v: any) => [fmt(Number(v), spec.unit), spec.measureLabel] as [string, string],
  };

  return (
    <div className="mt-1">
      <p className="text-sm font-semibold text-slate-100">{spec.title}</p>
      <p className="text-[11px] text-slate-400 mb-2">{spec.description}</p>
      <div className="w-full h-[220px] bg-slate-950/50 rounded-lg border border-slate-800 p-2">
        <ResponsiveContainer width="100%" height="100%">
          {spec.chartType === 'line' ? (
            <LineChart data={rows} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 9 }} interval={tickInterval} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} width={38} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2} dot={false} />
            </LineChart>
          ) : spec.chartType === 'area' ? (
            <AreaChart data={rows} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={areaTop} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 9 }} interval={tickInterval} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} width={38} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="value" stroke={accent} strokeWidth={2} fill={`url(#${gradId})`} />
            </AreaChart>
          ) : spec.chartType === 'horizontalBar' ? (
            <BarChart layout="vertical" data={rows} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} />
              <YAxis type="category" dataKey="category" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} width={90} />
              <Tooltip {...tooltipStyle} cursor={{ fill: '#1e293b55' }} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                {rows.map((_, i) => {
                  const c = cellFill(i);
                  return <Cell key={i} fill={c.fill} fillOpacity={c.fillOpacity} />;
                })}
              </Bar>
            </BarChart>
          ) : spec.chartType === 'bar' ? (
            <BarChart data={rows} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 9 }} interval={tickInterval} tickLine={false} angle={spec.kind === 'breakdown' ? -20 : 0} textAnchor={spec.kind === 'breakdown' ? 'end' : 'middle'} height={spec.kind === 'breakdown' ? 44 : 24} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} width={38} />
              <Tooltip {...tooltipStyle} cursor={{ fill: '#1e293b55' }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {rows.map((_, i) => {
                  const c = cellFill(i);
                  return <Cell key={i} fill={c.fill} fillOpacity={c.fillOpacity} />;
                })}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={78} innerRadius={38} paddingAngle={2}>
                {rows.map((_, i) => {
                  const c = cellFill(i);
                  return <Cell key={i} fill={c.fill} fillOpacity={c.fillOpacity} />;
                })}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
