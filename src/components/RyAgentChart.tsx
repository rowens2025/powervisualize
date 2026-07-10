import {
  ResponsiveContainer,
  LineChart,
  Line,
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

export type ChartSpec = {
  metricId: string;
  title: string;
  chartType: 'line' | 'bar' | 'pie';
  kind: 'trend' | 'breakdown';
  categoryLabel: string;
  measureLabel: string;
  unit: string;
  description: string;
};

export type ChartRow = { category: string; value: number };

const PALETTE = ['#22d3ee', '#a855f7', '#f472b6', '#38bdf8', '#818cf8', '#2dd4bf', '#fb923c', '#f43f5e'];

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

  const tooltipStyle = {
    contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
    labelStyle: { color: '#e2e8f0' },
    itemStyle: { color: '#22d3ee' },
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
              <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          ) : spec.chartType === 'bar' ? (
            <BarChart data={rows} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 9 }} interval={tickInterval} tickLine={false} angle={spec.kind === 'breakdown' ? -20 : 0} textAnchor={spec.kind === 'breakdown' ? 'end' : 'middle'} height={spec.kind === 'breakdown' ? 44 : 24} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} width={38} />
              <Tooltip {...tooltipStyle} cursor={{ fill: '#1e293b55' }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={78} innerRadius={38} paddingAngle={2}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
