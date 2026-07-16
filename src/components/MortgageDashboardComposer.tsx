import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import type { ChartSpec, ChartRow, ChartType } from './RyAgentChart';
import { NAMED_COLORS } from './RyAgentChart';
import type { RunSpec, DashboardOp, TileContext } from './dashboardTypes';
import RyAgentDashboardBuilder from './RyAgentDashboardBuilder';

// recharts is heavy — load the chart renderer on demand (same pattern as the drawer).
const RyAgentChart = lazy(() => import('./RyAgentChart'));

/**
 * "Build your own dashboard" composer for the Fannie Mae page.
 *
 * The visitor assembles governed metrics into a persistent grid — a real
 * self-serve mini-dashboard — either by hand (picker + chart-type toggles) or by
 * chatting with the RyAgent Dashboard Builder pop-up, which mutates this same
 * grid live. Every tile is a {metricId, chartType, filters, …} run spec through
 * the read-only semantic layer (/api/visualize) — the model/user only SELECTS a
 * curated metric, never raw SQL.
 *
 * Persistence: the run specs (not the data) are saved to localStorage; each tile
 * refetches on load so the dashboard always reflects the live warehouse.
 */

const STORAGE_KEY = 'mortgage_dashboard_v2';
const MAX_TILES = 8;

type CatalogMetric = {
  id: string;
  label: string;
  description: string;
  kind: 'trend' | 'breakdown';
  chartTypes: ChartType[];
  defaultChart: ChartType;
};

type SavedTile = { id: string; runSpec: RunSpec };

type TileState = {
  id: string;
  runSpec: RunSpec;
  status: 'loading' | 'ready' | 'error';
  chartSpec?: ChartSpec;
  rows?: ChartRow[];
  error?: string;
};

const CHART_TYPE_LABEL: Record<ChartType, string> = {
  line: 'Line',
  area: 'Area',
  bar: 'Bar',
  horizontalBar: 'H-Bar',
  pie: 'Pie',
};

// Curated accent swatches for the per-tile color picker.
const SWATCHES = ['cyan', 'blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'green', 'teal'];

// A sensible starter dashboard so the empty state is one click from something real.
const QUICK_START: RunSpec[] = [
  { metricId: 'delinquency_rate_30_plus_trend', chartType: 'line' },
  { metricId: 'portfolio_by_delinquency_bucket', chartType: 'bar' },
  { metricId: 'loans_by_state', chartType: 'horizontalBar' },
  { metricId: 'loans_by_purpose', chartType: 'pie' },
];

async function runSpec(spec: RunSpec): Promise<{ ok: true; chartSpec: ChartSpec; rows: ChartRow[] } | { ok: false; error: string }> {
  try {
    const resp = await fetch('/api/visualize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'run', spec }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.chartSpec) return { ok: false, error: data.error || 'Could not load this metric.' };
    return { ok: true, chartSpec: data.chartSpec as ChartSpec, rows: (data.rows as ChartRow[]) || [] };
  } catch {
    return { ok: false, error: 'The mortgage data source is unavailable right now.' };
  }
}

function loadSaved(): SavedTile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && t.runSpec && typeof t.runSpec.metricId === 'string')
      .slice(0, MAX_TILES)
      .map((t, i) => ({ id: t.id || `t${i}_${Date.now()}`, runSpec: t.runSpec as RunSpec }));
  } catch {
    return [];
  }
}

// Stable per-browser id, shared with the main RyAgent so turns group together.
function getSessionId(): string | undefined {
  try {
    const existing = localStorage.getItem('ryagent_sid');
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sid_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem('ryagent_sid', id);
    return id;
  } catch {
    return undefined;
  }
}

export default function MortgageDashboardComposer() {
  const [catalog, setCatalog] = useState<CatalogMetric[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [tiles, setTiles] = useState<TileState[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [title, setTitle] = useState('My Mortgage Dashboard');
  const idCounter = useRef(0);
  const nextId = () => `tile_${Date.now()}_${idCounter.current++}`;

  const catalogById = useCallback((id: string) => catalog.find((m) => m.id === id), [catalog]);

  // Persist the run specs (not the data) whenever tiles change.
  useEffect(() => {
    try {
      const saved: SavedTile[] = tiles.map((t) => ({ id: t.id, runSpec: t.runSpec }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* storage unavailable — dashboard just won't persist */
    }
  }, [tiles]);

  const patchTile = (id: string, patch: Partial<TileState>) => {
    setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const fetchTile = async (id: string, spec: RunSpec) => {
    patchTile(id, { status: 'loading', error: undefined });
    const out = await runSpec(spec);
    if (out.ok) patchTile(id, { status: 'ready', chartSpec: out.chartSpec, rows: out.rows });
    else patchTile(id, { status: 'error', error: out.error });
  };

  // Load the metric catalog once, then restore any saved dashboard and fetch it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/visualize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'list' }),
        });
        const data = await resp.json();
        if (cancelled) return;
        if (!Array.isArray(data.metrics)) {
          setCatalogError(true);
          return;
        }
        setCatalog(data.metrics as CatalogMetric[]);
        const saved = loadSaved();
        if (saved.length > 0) {
          setTiles(saved.map((t) => ({ ...t, status: 'loading' as const })));
          saved.forEach((t) => fetchTile(t.id, t.runSpec));
        }
      } catch {
        if (!cancelled) setCatalogError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addTile = (metricId: string, chartType?: ChartType) => {
    const metric = catalogById(metricId);
    if (!metric || tiles.length >= MAX_TILES) return;
    const ct = chartType && metric.chartTypes.includes(chartType) ? chartType : metric.defaultChart;
    const id = nextId();
    const spec: RunSpec = { metricId, chartType: ct };
    setTiles((prev) => [...prev, { id, runSpec: spec, status: 'loading' }]);
    setPickerOpen(false);
    fetchTile(id, spec);
  };

  const changeChartType = (id: string, chartType: ChartType) => {
    const tile = tiles.find((t) => t.id === id);
    if (!tile) return;
    const spec = { ...tile.runSpec, chartType };
    patchTile(id, { runSpec: spec });
    fetchTile(id, spec);
  };

  // Color is display-only, so apply it locally (no DB refetch).
  const changeColor = (id: string, color?: string) => {
    setTiles((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, runSpec: { ...t.runSpec, color }, chartSpec: t.chartSpec ? { ...t.chartSpec, color } : t.chartSpec } : t,
      ),
    );
  };

  const removeTile = (id: string) => setTiles((prev) => prev.filter((t) => t.id !== id));
  const refreshAll = () => tiles.forEach((t) => fetchTile(t.id, t.runSpec));
  const clearAll = () => setTiles([]);

  const quickStart = () => {
    if (catalog.length === 0) return;
    const built: TileState[] = QUICK_START.filter((q) => catalogById(q.metricId))
      .slice(0, MAX_TILES)
      .map((q) => ({ id: nextId(), runSpec: q, status: 'loading' as const }));
    setTiles(built);
    built.forEach((t) => fetchTile(t.id, t.runSpec));
  };

  // Apply an operation streamed by the RyAgent Dashboard Builder to the live grid.
  const applyOp = useCallback((op: DashboardOp) => {
    if (op.op === 'add') {
      setTiles((prev) => {
        if (prev.length >= MAX_TILES) return prev;
        return [...prev, { id: nextId(), runSpec: op.tile.runSpec, status: 'ready', chartSpec: op.tile.chartSpec, rows: op.tile.rows }];
      });
    } else if (op.op === 'update') {
      setTiles((prev) => prev.map((t) => (t.id === op.tileId ? { ...t, runSpec: op.tile.runSpec, status: 'ready', chartSpec: op.tile.chartSpec, rows: op.tile.rows, error: undefined } : t)));
    } else if (op.op === 'remove') {
      setTiles((prev) => prev.filter((t) => t.id !== op.tileId));
    } else if (op.op === 'clear') {
      setTiles([]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tilesContext: TileContext[] = tiles.map((t) => ({
    tileId: t.id,
    label: t.chartSpec?.title || t.runSpec.metricId,
    spec: t.runSpec,
  }));

  if (catalogError) {
    return (
      <div className="max-w-3xl mx-auto px-1">
        <div className="rounded-2xl ring-1 ring-slate-800 p-6 text-sm text-slate-400">
          The dashboard builder is unavailable right now — the mortgage data source isn’t responding. Please try again in a moment.
        </div>
      </div>
    );
  }

  const trends = catalog.filter((m) => m.kind === 'trend');
  const breakdowns = catalog.filter((m) => m.kind === 'breakdown');
  const atMax = tiles.length >= MAX_TILES;

  return (
    <section className="max-w-5xl mx-auto px-1">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none" aria-hidden>🧩</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 60))}
                aria-label="Dashboard title"
                className="bg-transparent text-base sm:text-lg font-semibold text-slate-100 border-b border-transparent hover:border-slate-700 focus:border-cyan-500/60 focus:outline-none min-w-0 w-full max-w-[22rem]"
              />
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
              Compose your own dashboard from the live Fannie Mae warehouse — add charts by hand, or chat with the
              builder to add, filter, and reshape them. It saves in your browser and reads from the same governed,
              read-only semantic layer (no raw SQL).
            </p>
          </div>
          {tiles.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={refreshAll} className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-cyan-500/40 text-slate-300">
                ↻ Refresh
              </button>
              <button onClick={clearAll} className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-300">
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setBuilderOpen(true)}
            disabled={catalog.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-900 shadow-lg shadow-cyan-900/20 hover:opacity-95 disabled:opacity-50"
          >
            <span aria-hidden>🤖</span> Build with RyAgent
          </button>
          <button
            onClick={() => setPickerOpen((v) => !v)}
            disabled={atMax || catalog.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm border border-slate-700 hover:bg-slate-800 hover:border-cyan-500/40 text-slate-200 disabled:opacity-50"
          >
            <span aria-hidden>＋</span> Add a chart
          </button>
          {atMax && <span className="text-[11px] text-slate-500">Max {MAX_TILES} charts — remove one to add another.</span>}
        </div>

        {/* Manual picker */}
        {pickerOpen && !atMax && (
          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">Trends over time</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {trends.map((m) => (
                <button key={m.id} onClick={() => addTile(m.id)} title={m.description} className="px-2.5 py-1 text-[11px] rounded-md border border-slate-700 hover:bg-slate-800 hover:border-cyan-500/40 text-slate-300">
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">Breakdowns</p>
            <div className="flex flex-wrap gap-1.5">
              {breakdowns.map((m) => (
                <button key={m.id} onClick={() => addTile(m.id)} title={m.description} className="px-2.5 py-1 text-[11px] rounded-md border border-slate-700 hover:bg-slate-800 hover:border-cyan-500/40 text-slate-300">
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {tiles.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center">
            <p className="text-sm text-slate-300">Your dashboard is empty.</p>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              Chat with the builder, add charts one at a time, or start from a ready-made set of four.
            </p>
            <button
              onClick={quickStart}
              disabled={catalog.length === 0}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 disabled:opacity-50"
            >
              ✨ Quick-start a dashboard
            </button>
          </div>
        )}

        {/* Tile grid */}
        {tiles.length > 0 && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tiles.map((tile) => {
              const metric = catalogById(tile.runSpec.metricId);
              const allowedTypes = metric?.chartTypes ?? [];
              return (
                <div key={tile.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex flex-wrap gap-1">
                      {allowedTypes.map((ct) => (
                        <button
                          key={ct}
                          onClick={() => changeChartType(tile.id, ct)}
                          className={`px-2 py-0.5 text-[10px] rounded border ${
                            tile.runSpec.chartType === ct ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {CHART_TYPE_LABEL[ct]}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => removeTile(tile.id)}
                      aria-label="Remove chart"
                      className="shrink-0 w-6 h-6 grid place-items-center rounded-md border border-slate-700 text-slate-500 hover:text-red-300 hover:border-red-500/40"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Color picker */}
                  <div className="flex items-center gap-1 mb-1">
                    {SWATCHES.map((c) => (
                      <button
                        key={c}
                        onClick={() => changeColor(tile.id, c)}
                        aria-label={`Color ${c}`}
                        title={c}
                        className={`w-4 h-4 rounded-full border ${tile.runSpec.color === c ? 'ring-2 ring-offset-1 ring-offset-slate-950 ring-white/70 border-white/40' : 'border-slate-600'}`}
                        style={{ backgroundColor: NAMED_COLORS[c] }}
                      />
                    ))}
                    <button
                      onClick={() => changeColor(tile.id, undefined)}
                      title="Default palette"
                      className={`ml-1 px-1.5 py-0.5 text-[10px] rounded border ${!tile.runSpec.color ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                    >
                      Auto
                    </button>
                  </div>

                  {tile.status === 'loading' && (
                    <div className="h-[260px] grid place-items-center">
                      <span className="text-xs text-slate-500 animate-pulse">Querying the Fannie Mae warehouse…</span>
                    </div>
                  )}
                  {tile.status === 'error' && (
                    <div className="h-[260px] grid place-items-center px-4 text-center">
                      <div>
                        <p className="text-xs text-red-300">{tile.error}</p>
                        <button onClick={() => fetchTile(tile.id, tile.runSpec)} className="mt-2 px-3 py-1 text-[11px] rounded-md border border-slate-700 hover:bg-slate-800 text-slate-300">
                          Retry
                        </button>
                      </div>
                    </div>
                  )}
                  {tile.status === 'ready' && tile.chartSpec && tile.rows && (
                    <Suspense fallback={<div className="h-[260px] grid place-items-center text-xs text-slate-500">Rendering…</div>}>
                      <RyAgentChart spec={tile.chartSpec} rows={tile.rows} />
                    </Suspense>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RyAgentDashboardBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        tiles={tilesContext}
        onApplyOp={applyOp}
        getSessionId={getSessionId}
      />
    </section>
  );
}
