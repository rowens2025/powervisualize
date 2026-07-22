import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import type { ChartSpec, ChartRow, ChartType } from './RyAgentChart';
import type { TileSpan } from './dashboardTypes';
import type {
  SportsRunSpec,
  SportsStatSpec,
  BuiltSportsStat,
  SportsDashboardOp,
  SportsTileContext,
  SportsCatalogMetric,
  SportsStatus,
  IngestSummary,
  BuiltSportsTile,
} from './sportsTypes';
import SportsRyAgentPanel from './SportsRyAgentPanel';

// recharts is heavy — load the chart renderer on demand (same pattern as the composer).
const RyAgentChart = lazy(() => import('./RyAgentChart'));

/**
 * MLB dashboard studio — the sports page's live, AI-built dashboard.
 *
 * Daily ESPN scores land in the warehouse (Vercel cron), dbt models them into
 * marts, and this grid reads them through a governed semantic layer
 * (/api/sports/query). Visitors build the dashboard by chatting with RyAgent
 * (docked side panel — it composes entire dashboards, edits single tiles, and
 * answers questions) or by hand.
 *
 * A dashboard is a designed layout, not a stack of charts: a KPI band of
 * headline numbers up top, then charts grouped into named sections. Tiles come
 * in two kinds — `stat` (one governed number) and `chart` (a full comparison).
 *
 * Persistence: specs (not data) go to localStorage; tiles refetch on load so
 * the dashboard always reflects the live warehouse.
 */

const STORAGE_KEY = 'sports_dashboard_v2';
const TITLE_KEY = 'sports_dashboard_title_v1';
const MAX_TILES = 8;

type SavedTile = {
  id: string;
  kind: 'chart' | 'stat';
  section?: string;
  // chart
  runSpec?: SportsRunSpec;
  span?: TileSpan;
  filterControls?: string[];
  // stat
  statSpec?: SportsStatSpec;
};

type BaseTile = { id: string; section?: string; status: 'loading' | 'ready' | 'error'; error?: string };
type ChartTile = BaseTile & {
  kind: 'chart';
  runSpec: SportsRunSpec;
  span: TileSpan;
  /** Dimensions exposed as interactive dropdown filters on this tile. */
  filterControls: string[];
  chartSpec?: ChartSpec;
  rows?: ChartRow[];
};
type StatTile = BaseTile & { kind: 'stat'; statSpec: SportsStatSpec; stat?: BuiltSportsStat };
type TileState = ChartTile | StatTile;

type DimValue = { code: string; label: string };

const CHART_TYPE_LABEL: Record<Exclude<ChartType, 'combo'>, string> = {
  line: 'Line',
  area: 'Area',
  bar: 'Bar',
  horizontalBar: 'H-Bar',
  pie: 'Pie',
};

const DIM_LABEL: Record<string, string> = { season: 'Season', team: 'Team' };

/** A designed starter dashboard: KPI band + grouped charts, one click from real. */
type Starter =
  | { kind: 'stat'; statSpec: SportsStatSpec }
  | { kind: 'chart'; runSpec: SportsRunSpec; span: TileSpan; section?: string; filterControls?: string[] };

const QUICK_START: Starter[] = [
  { kind: 'stat', statSpec: { metric: 'wins_by_team', label: 'Wins leader' } },
  { kind: 'stat', statSpec: { metric: 'run_diff_by_team', label: 'Best run differential' } },
  { kind: 'stat', statSpec: { metric: 'runs_scored_by_team', label: 'Top offense' } },
  { kind: 'stat', statSpec: { metric: 'win_pct_by_team', label: 'Best win %' } },
  { kind: 'chart', runSpec: { metric: 'wins_by_team', chartType: 'bar', limit: 10 }, span: 'full', section: 'Standings' },
  { kind: 'chart', runSpec: { metric: 'run_diff_by_team', chartType: 'bar', limit: 10 }, span: 'half', section: 'Standings' },
  { kind: 'chart', runSpec: { metric: 'runs_scored_by_team', chartType: 'horizontalBar', limit: 10 }, span: 'half', section: 'Offense & pitching' },
  { kind: 'chart', runSpec: { metric: 'runs_allowed_by_team', chartType: 'horizontalBar', limit: 10, sort: 'asc' }, span: 'half', section: 'Offense & pitching' },
];

/** Mirror of the server-side title logic so hand-built tiles read the same. */
function displayTitle(base: string, spec: SportsRunSpec): string {
  if (spec.title?.trim()) return spec.title.trim();
  const suffix = [spec.team, spec.season].filter(Boolean).join(' · ');
  return suffix ? `${base} — ${suffix}` : base;
}

async function runSpec(spec: SportsRunSpec): Promise<{ ok: true; chartSpec: ChartSpec; rows: ChartRow[] } | { ok: false; error: string }> {
  try {
    // Two-metric tiles: combine into one chart (combo) or crunch a new metric (derived).
    const body = spec.metric2
      ? spec.deriveOp
        ? { mode: 'derived', metricA: spec.metric, metricB: spec.metric2, op: spec.deriveOp, label: spec.title, season: spec.season, sort: spec.sort, limit: spec.limit }
        : { mode: 'combo', metricA: spec.metric, metricB: spec.metric2, season: spec.season, sort: spec.sort, limit: spec.limit }
      : { metric: spec.metric, season: spec.season, team: spec.team, sort: spec.sort, limit: spec.limit, chartType: spec.chartType };
    const resp = await fetch('/api/sports/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.chartSpec) return { ok: false, error: data.error || 'Could not load this metric.' };
    const chartSpec: ChartSpec = {
      ...(data.chartSpec as ChartSpec),
      title: displayTitle((data.chartSpec as ChartSpec).title, spec),
      color: spec.color,
      opacity: spec.opacity,
    };
    return { ok: true, chartSpec, rows: (data.rows as ChartRow[]) || [] };
  } catch {
    return { ok: false, error: 'The sports data source is unavailable right now.' };
  }
}

async function runStat(spec: SportsStatSpec): Promise<{ ok: true; stat: BuiltSportsStat } | { ok: false; error: string }> {
  try {
    const resp = await fetch('/api/sports/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'stat', metric: spec.metric, season: spec.season, team: spec.team, sort: spec.sort, label: spec.label }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.stat) return { ok: false, error: data.error || 'Could not load this stat.' };
    return { ok: true, stat: data.stat as BuiltSportsStat };
  } catch {
    return { ok: false, error: 'The sports data source is unavailable right now.' };
  }
}

function loadSaved(): SavedTile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && (t.kind === 'stat' ? t.statSpec?.metric : typeof t.runSpec?.metric === 'string'))
      .slice(0, MAX_TILES)
      .map((t, i) => {
        const id = t.id || `t${i}_${Date.now()}`;
        const section = typeof t.section === 'string' ? t.section : undefined;
        if (t.kind === 'stat') return { id, kind: 'stat' as const, section, statSpec: t.statSpec as SportsStatSpec };
        return {
          id,
          kind: 'chart' as const,
          section,
          runSpec: t.runSpec as SportsRunSpec,
          span: t.span === 'full' ? ('full' as const) : ('half' as const),
          filterControls: Array.isArray(t.filterControls) ? t.filterControls : [],
        };
      });
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

/** Group the ordered tiles into render blocks: KPI band on top, then charts by section. */
type Block =
  | { type: 'stats'; key: string; tiles: StatTile[] }
  | { type: 'section'; key: string; label: string }
  | { type: 'charts'; key: string; tiles: ChartTile[] };

function buildBlocks(tiles: TileState[]): Block[] {
  const stats = tiles.filter((t): t is StatTile => t.kind === 'stat');
  const charts = tiles.filter((t): t is ChartTile => t.kind === 'chart');
  const blocks: Block[] = [];
  if (stats.length) blocks.push({ type: 'stats', key: 'kpi', tiles: stats });
  let curSection: string | undefined;
  let buf: ChartTile[] = [];
  let seq = 0;
  const flush = () => {
    if (buf.length) {
      blocks.push({ type: 'charts', key: `c${seq++}`, tiles: buf });
      buf = [];
    }
  };
  for (const c of charts) {
    if (c.section !== curSection) {
      flush();
      curSection = c.section;
      if (c.section) blocks.push({ type: 'section', key: `h${seq++}`, label: c.section });
    }
    buf.push(c);
  }
  flush();
  return blocks;
}

export default function SportsDashboardStudio() {
  const [catalog, setCatalog] = useState<SportsCatalogMetric[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [dimValues, setDimValues] = useState<Record<string, DimValue[]>>({});
  const [tiles, setTiles] = useState<TileState[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filterMenuFor, setFilterMenuFor] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [title, setTitle] = useState('My MLB Dashboard');
  const [status, setStatus] = useState<SportsStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const idCounter = useRef(0);
  const nextId = () => `tile_${Date.now()}_${idCounter.current++}`;

  const catalogById = useCallback((id: string) => catalog.find((m) => m.id === id), [catalog]);

  // Fetch (and cache) the selectable values for a dimension's dropdown.
  const ensureDimValues = useCallback(
    async (dimension: string) => {
      if (dimValues[dimension]) return;
      try {
        const resp = await fetch('/api/sports/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'values', dimension }),
        });
        const data = await resp.json();
        setDimValues((prev) => ({ ...prev, [dimension]: Array.isArray(data.values) ? data.values : [] }));
      } catch {
        setDimValues((prev) => ({ ...prev, [dimension]: [] }));
      }
    },
    [dimValues],
  );

  // Persist the specs (not the data) whenever tiles change.
  useEffect(() => {
    try {
      const saved: SavedTile[] = tiles.map((t) =>
        t.kind === 'stat'
          ? { id: t.id, kind: 'stat', section: t.section, statSpec: t.statSpec }
          : { id: t.id, kind: 'chart', section: t.section, runSpec: t.runSpec, span: t.span, filterControls: t.filterControls },
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* storage unavailable — dashboard just won't persist */
    }
  }, [tiles]);

  useEffect(() => {
    try {
      localStorage.setItem(TITLE_KEY, title);
    } catch {
      /* ignore */
    }
  }, [title]);

  // Let the page-level "Build a dashboard with RyAgent" CTA open the docked panel.
  useEffect(() => {
    const open = () => setPanelOpen(true);
    window.addEventListener('sports:build-dashboard', open);
    return () => window.removeEventListener('sports:build-dashboard', open);
  }, []);

  // Make sure every active dropdown has its values loaded (restore + agent-added).
  useEffect(() => {
    const dims = new Set<string>();
    tiles.forEach((t) => t.kind === 'chart' && t.filterControls.forEach((d) => dims.add(d)));
    dims.forEach((d) => ensureDimValues(d));
  }, [tiles, ensureDimValues]);

  const patchTile = (id: string, patch: Partial<ChartTile> & Partial<StatTile>) => {
    setTiles((prev) => prev.map((t) => (t.id === id ? ({ ...t, ...patch } as TileState) : t)));
  };

  const fetchChartTile = async (id: string, spec: SportsRunSpec) => {
    patchTile(id, { status: 'loading', error: undefined });
    const out = await runSpec(spec);
    if (out.ok) patchTile(id, { status: 'ready', chartSpec: out.chartSpec, rows: out.rows });
    else patchTile(id, { status: 'error', error: out.error });
  };

  const fetchStatTile = async (id: string, spec: SportsStatSpec) => {
    patchTile(id, { status: 'loading', error: undefined });
    const out = await runStat(spec);
    if (out.ok) patchTile(id, { status: 'ready', stat: out.stat });
    else patchTile(id, { status: 'error', error: out.error });
  };

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/sports/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'status' }),
      });
      const data = await resp.json();
      if (typeof data.games === 'number') setStatus(data as SportsStatus);
    } catch {
      /* status strip just stays empty */
    }
  }, []);

  // Load the metric catalog + warehouse status once, then restore any saved dashboard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/sports/meta');
        const data = await resp.json();
        if (cancelled) return;
        if (!Array.isArray(data.metrics)) {
          setCatalogError(true);
          return;
        }
        setCatalog(data.metrics as SportsCatalogMetric[]);
        try {
          const savedTitle = localStorage.getItem(TITLE_KEY);
          if (savedTitle) setTitle(savedTitle.slice(0, 60));
        } catch {
          /* ignore */
        }
        const saved = loadSaved();
        if (saved.length > 0) {
          setTiles(
            saved.map((t) =>
              t.kind === 'stat'
                ? { id: t.id, kind: 'stat', section: t.section, statSpec: t.statSpec as SportsStatSpec, status: 'loading' as const }
                : {
                    id: t.id,
                    kind: 'chart',
                    section: t.section,
                    runSpec: t.runSpec as SportsRunSpec,
                    span: (t.span ?? 'half') as TileSpan,
                    filterControls: t.filterControls ?? [],
                    status: 'loading' as const,
                  },
            ),
          );
          saved.forEach((t) => (t.kind === 'stat' ? fetchStatTile(t.id, t.statSpec as SportsStatSpec) : fetchChartTile(t.id, t.runSpec as SportsRunSpec)));
        }
      } catch {
        if (!cancelled) setCatalogError(true);
      }
    })();
    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addChart = (metricId: string, chartType?: ChartType) => {
    const metric = catalogById(metricId);
    if (!metric || tiles.length >= MAX_TILES) return;
    const ct = chartType && metric.chartTypes.includes(chartType) ? chartType : metric.defaultChart;
    const id = nextId();
    // Per-team trends need a team — default to LAD and give the visitor the dropdown.
    const spec: SportsRunSpec = metric.requiresTeam ? { metric: metricId, chartType: ct, team: 'LAD' } : { metric: metricId, chartType: ct };
    const filterControls = metric.requiresTeam ? ['team'] : [];
    if (metric.requiresTeam) ensureDimValues('team');
    setTiles((prev) => [...prev, { id, kind: 'chart', runSpec: spec, span: 'half', filterControls, status: 'loading' }]);
    setPickerOpen(false);
    fetchChartTile(id, spec);
  };

  const addStat = (metricId: string) => {
    const metric = catalogById(metricId);
    if (!metric || tiles.length >= MAX_TILES) return;
    const id = nextId();
    const statSpec: SportsStatSpec = { metric: metricId };
    setTiles((prev) => [...prev, { id, kind: 'stat', statSpec, status: 'loading' }]);
    setPickerOpen(false);
    fetchStatTile(id, statSpec);
  };

  const changeChartType = (id: string, chartType: ChartType) => {
    const tile = tiles.find((t) => t.id === id);
    if (!tile || tile.kind !== 'chart') return;
    const spec = { ...tile.runSpec, chartType };
    patchTile(id, { runSpec: spec });
    fetchChartTile(id, spec);
  };

  const removeTile = (id: string) => setTiles((prev) => prev.filter((t) => t.id !== id));

  // Expose a dimension as an interactive dropdown on a chart tile.
  const addFilterControl = (id: string, dimension: string) => {
    ensureDimValues(dimension);
    setTiles((prev) =>
      prev.map((t) => (t.id === id && t.kind === 'chart' && !t.filterControls.includes(dimension) ? { ...t, filterControls: [...t.filterControls, dimension] } : t)),
    );
    setFilterMenuFor(null);
  };

  // Remove a dropdown and drop its applied filter, then refetch.
  const removeFilterControl = (id: string, dimension: string) => {
    const tile = tiles.find((t) => t.id === id);
    if (!tile || tile.kind !== 'chart') return;
    // A required team stays put — the dropdown is how the visitor drives it.
    if (dimension === 'team' && catalogById(tile.runSpec.metric)?.requiresTeam) return;
    const spec = { ...tile.runSpec, [dimension]: undefined } as SportsRunSpec;
    setTiles((prev) => prev.map((t) => (t.id === id && t.kind === 'chart' ? { ...t, filterControls: t.filterControls.filter((d) => d !== dimension), runSpec: spec } : t)));
    fetchChartTile(id, spec);
  };

  // Apply a dropdown selection: '' clears (latest season / all teams).
  const setFilterValue = (id: string, dimension: string, value: string) => {
    const tile = tiles.find((t) => t.id === id);
    if (!tile || tile.kind !== 'chart') return;
    if (dimension === 'team' && !value && catalogById(tile.runSpec.metric)?.requiresTeam) return;
    const spec: SportsRunSpec = {
      ...tile.runSpec,
      [dimension]: value ? (dimension === 'season' ? Number(value) : value) : undefined,
    };
    setTiles((prev) => prev.map((t) => (t.id === id && t.kind === 'chart' ? { ...t, runSpec: spec } : t)));
    fetchChartTile(id, spec);
  };

  const refetchAll = useCallback(() => {
    setTiles((prev) => {
      prev.forEach((t) => (t.kind === 'stat' ? fetchStatTile(t.id, t.statSpec) : fetchChartTile(t.id, t.runSpec)));
      return prev;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearAll = () => setTiles([]);

  const quickStart = () => {
    if (catalog.length === 0) return;
    const built: TileState[] = QUICK_START.filter((q) => catalogById(q.kind === 'stat' ? q.statSpec.metric : q.runSpec.metric))
      .slice(0, MAX_TILES)
      .map((q) =>
        q.kind === 'stat'
          ? { id: nextId(), kind: 'stat', statSpec: q.statSpec, status: 'loading' as const }
          : { id: nextId(), kind: 'chart', runSpec: q.runSpec, span: q.span, section: q.section, filterControls: q.filterControls ?? [], status: 'loading' as const },
      );
    setTiles(built);
    setTitle('MLB League Overview');
    built.forEach((t) => (t.kind === 'stat' ? fetchStatTile(t.id, t.statSpec) : fetchChartTile(t.id, t.runSpec)));
  };

  // Re-run the ingest job: pull the last few days from ESPN into the warehouse.
  const refreshWarehouse = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshNote(null);
    try {
      const resp = await fetch('/api/sports-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 3 }),
      });
      const data: Partial<IngestSummary> & { error?: string } = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        setRefreshNote(data.error || 'Refresh failed — please try again in a moment.');
      } else {
        setRefreshNote(`Ingested ${data.gamesUpserted ?? 0} games (latest: ${data.latestGameDate ?? 'n/a'}).`);
        refetchAll();
        fetchStatus();
      }
    } catch {
      setRefreshNote('Refresh failed — please try again in a moment.');
    } finally {
      setRefreshing(false);
    }
  };

  // Apply an operation streamed by RyAgent to the live grid.
  const applyOp = useCallback((op: SportsDashboardOp) => {
    if (op.op === 'add') {
      setTiles((prev) => {
        if (prev.length >= MAX_TILES) return prev;
        const tile = op.tile as BuiltSportsTile;
        // Adopt the server's tileId so a same-turn organize/update can target this tile.
        return [...prev, { id: op.id ?? nextId(), kind: 'chart', runSpec: tile.runSpec, span: 'half', filterControls: [], status: 'ready', chartSpec: tile.chartSpec, rows: tile.rows }];
      });
    } else if (op.op === 'add_stat') {
      setTiles((prev) => {
        if (prev.length >= MAX_TILES) return prev;
        return [...prev, { id: op.id ?? nextId(), kind: 'stat', statSpec: op.stat.statSpec, status: 'ready', stat: op.stat }];
      });
    } else if (op.op === 'update') {
      setTiles((prev) =>
        prev.map((t) =>
          t.id === op.tileId && t.kind === 'chart' ? { ...t, runSpec: op.tile.runSpec, status: 'ready', chartSpec: op.tile.chartSpec, rows: op.tile.rows, error: undefined } : t,
        ),
      );
    } else if (op.op === 'update_stat') {
      setTiles((prev) => prev.map((t) => (t.id === op.tileId && t.kind === 'stat' ? { ...t, statSpec: op.stat.statSpec, status: 'ready', stat: op.stat, error: undefined } : t)));
    } else if (op.op === 'remove') {
      setTiles((prev) => prev.filter((t) => t.id !== op.tileId));
    } else if (op.op === 'clear') {
      setTiles([]);
    } else if (op.op === 'set_title') {
      setTitle(op.title.slice(0, 60));
    } else if (op.op === 'organize') {
      if (op.title) setTitle(op.title.slice(0, 60));
      setTiles((prev) => {
        const byId = new Map(prev.map((t) => [t.id, t]));
        const ordered: TileState[] = [];
        for (const item of op.layout) {
          const t = byId.get(item.tileId);
          if (!t) continue;
          if (t.kind === 'chart') ordered.push({ ...t, span: item.span === 'full' ? 'full' : 'half', section: item.section });
          else ordered.push({ ...t, section: item.section });
          byId.delete(item.tileId);
        }
        // Any tiles the layout didn't mention keep their place at the end.
        for (const t of prev) if (byId.has(t.id)) ordered.push(t);
        return ordered;
      });
    } else if (op.op === 'add_filter') {
      ensureDimValues(op.dimension);
      setTiles((prev) =>
        prev.map((t) => (t.id === op.tileId && t.kind === 'chart' && !t.filterControls.includes(op.dimension) ? { ...t, filterControls: [...t.filterControls, op.dimension] } : t)),
      );
    } else if (op.op === 'refetch') {
      refetchAll();
      fetchStatus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tilesContext: SportsTileContext[] = tiles.map((t) =>
    t.kind === 'stat'
      ? { tileId: t.id, kind: 'stat', label: t.stat?.caption || t.statSpec.metric, section: t.section, statSpec: t.statSpec }
      : { tileId: t.id, kind: 'chart', label: t.chartSpec?.title || t.runSpec.metric, section: t.section, span: t.span, filterControls: t.filterControls, spec: t.runSpec },
  );

  if (catalogError) {
    return (
      <div className="max-w-3xl mx-auto px-1">
        <div className="rounded-2xl ring-1 ring-slate-800 p-6 text-sm text-slate-400">
          The sports dashboard is unavailable right now — the data source isn’t responding. Please try again in a moment.
        </div>
      </div>
    );
  }

  const trends = catalog.filter((m) => m.kind === 'trend');
  const breakdowns = catalog.filter((m) => m.kind === 'breakdown');
  const atMax = tiles.length >= MAX_TILES;
  const blocks = buildBlocks(tiles);

  const renderChartCard = (tile: ChartTile) => {
    const metric = catalogById(tile.runSpec.metric);
    const allowedTypes = (metric?.chartTypes ?? []).filter((ct): ct is Exclude<ChartType, 'combo'> => ct !== 'combo');
    const metricDims = metric?.dimensions ?? [];
    const available = metricDims.filter((d) => !tile.filterControls.includes(d));
    return (
      <div key={tile.id} className={`group relative rounded-xl border border-slate-800 bg-slate-950/50 p-3.5 ${tile.span === 'full' ? 'lg:col-span-2' : ''}`}>
        <button
          onClick={() => removeTile(tile.id)}
          aria-label="Remove chart"
          className="absolute top-2.5 right-2.5 z-10 w-6 h-6 grid place-items-center rounded-md text-slate-600 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-300 hover:bg-slate-800 transition"
        >
          ✕
        </button>

        {/* Controls — chart-type toggles recede until the card is hovered/focused.
            The chart's own title/description render below via RyAgentChart. */}
        {allowedTypes.length > 1 && (
          <div className="flex flex-wrap gap-1 mb-2 pr-7 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
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
        )}

        {/* Interactive filter dropdowns */}
        {(tile.filterControls.length > 0 || available.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {tile.filterControls.map((dim) => {
              const isRequired = dim === 'team' && !!metric?.requiresTeam;
              const current = dim === 'season' ? (tile.runSpec.season != null ? String(tile.runSpec.season) : '') : tile.runSpec.team ?? '';
              const opts = dimValues[dim] ?? [];
              return (
                <div key={dim} className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/60 pl-2 pr-1 py-0.5">
                  <span className="text-[10px] text-slate-400">{DIM_LABEL[dim] ?? dim}:</span>
                  <select
                    value={current}
                    onChange={(e) => setFilterValue(tile.id, dim, e.target.value)}
                    className="bg-slate-900 text-[11px] text-slate-200 focus:outline-none max-w-[10rem]"
                  >
                    {!isRequired && <option value="">{dim === 'season' ? 'Latest' : 'All'}</option>}
                    {opts.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {!isRequired && (
                    <button onClick={() => removeFilterControl(tile.id, dim)} aria-label={`Remove ${DIM_LABEL[dim] ?? dim} filter`} className="text-slate-500 hover:text-red-300 text-[11px] px-0.5">
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
            {available.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setFilterMenuFor(filterMenuFor === tile.id ? null : tile.id)}
                  className="text-[10px] px-2 py-1 rounded-md border border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-cyan-500/40"
                >
                  ＋ Filter
                </button>
                {filterMenuFor === tile.id && (
                  <div className="absolute z-10 mt-1 rounded-md border border-slate-700 bg-slate-900 p-1 shadow-xl">
                    {available.map((d) => (
                      <button
                        key={d}
                        onClick={() => addFilterControl(tile.id, d)}
                        className="block w-full text-left text-[11px] px-2 py-1 rounded text-slate-300 hover:bg-slate-800 whitespace-nowrap"
                      >
                        {DIM_LABEL[d] ?? d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tile.status === 'loading' && (
          <div className="h-[260px] grid place-items-center">
            <span className="text-xs text-slate-500 animate-pulse">Querying the MLB warehouse…</span>
          </div>
        )}
        {tile.status === 'error' && (
          <div className="h-[260px] grid place-items-center px-4 text-center">
            <div>
              <p className="text-xs text-red-300">{tile.error}</p>
              <button onClick={() => fetchChartTile(tile.id, tile.runSpec)} className="mt-2 px-3 py-1 text-[11px] rounded-md border border-slate-700 hover:bg-slate-800 text-slate-300">
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
  };

  const renderStatCard = (tile: StatTile) => (
    <div key={tile.id} className="group relative rounded-xl border border-slate-800 bg-slate-950/50 p-4 flex flex-col justify-center min-h-[104px]">
      <button
        onClick={() => removeTile(tile.id)}
        aria-label="Remove stat"
        className="absolute top-2 right-2 w-5 h-5 grid place-items-center rounded text-slate-600 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-300 hover:bg-slate-800 transition text-xs"
      >
        ✕
      </button>
      {tile.status === 'loading' && (
        <div className="animate-pulse">
          <div className="h-2.5 w-24 rounded bg-slate-800" />
          <div className="mt-2.5 h-7 w-16 rounded bg-slate-800" />
          <div className="mt-2 h-2.5 w-28 rounded bg-slate-800" />
        </div>
      )}
      {tile.status === 'error' && <p className="text-xs text-red-300">{tile.error}</p>}
      {tile.status === 'ready' && tile.stat && (
        <>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 truncate">{tile.stat.caption}</p>
          {/* Proportional figures (not tabular) for a standalone display number */}
          <p className="mt-1 text-3xl font-semibold text-slate-50 leading-none">{tile.stat.formatted}</p>
          <p className="mt-1.5 text-xs text-slate-400 truncate">
            <span className="text-slate-300">{tile.stat.entity}</span>
            <span className="text-slate-600"> · </span>
            {tile.stat.sub}
          </p>
        </>
      )}
    </div>
  );

  return (
    <section className={`max-w-5xl mx-auto px-1 transition-[padding] duration-200 ${panelOpen ? 'lg:pr-[416px]' : ''}`}>
      {/* Warehouse status strip */}
      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Games in warehouse</p>
              <p className="text-lg font-semibold text-slate-100">{status ? status.games.toLocaleString() : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Latest game</p>
              <p className="text-lg font-semibold text-slate-100">{status?.latestGameDate ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Season</p>
              <p className="text-lg font-semibold text-slate-100">{status?.seasons?.[0] ?? '—'}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={refreshWarehouse}
              disabled={refreshing}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 disabled:opacity-60"
            >
              {refreshing ? 'Running ingest…' : '⟳ Pull latest games'}
            </button>
            <p className="text-[10px] text-slate-500">Auto-refreshes daily · re-runs the ESPN → warehouse job</p>
          </div>
        </div>
        {refreshNote && <p className="mt-2 text-[11px] text-cyan-300/90">{refreshNote}</p>}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none" aria-hidden>⚾</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 60))}
                aria-label="Dashboard title"
                className="bg-transparent text-base sm:text-lg font-semibold text-slate-100 border-b border-transparent hover:border-slate-700 focus:border-cyan-500/60 focus:outline-none min-w-0 w-full max-w-[22rem]"
              />
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
              Build an MLB dashboard on the fly — ask RyAgent for a whole dashboard in one sentence, reshape any tile
              by chatting, or add tiles by hand. It saves in your browser, and every tile resolves through a governed
              semantic layer — so the agent charts defined, trusted metrics instead of improvising queries.
            </p>
          </div>
          {tiles.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={refetchAll} className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-cyan-500/40 text-slate-300">
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
            onClick={() => setPanelOpen(true)}
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
            <span aria-hidden>＋</span> Add a tile
          </button>
          {atMax && <span className="text-[11px] text-slate-500">Max {MAX_TILES} tiles — remove one to add another.</span>}
        </div>

        {/* Manual picker */}
        {pickerOpen && !atMax && (
          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">KPI stats — one headline number</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {breakdowns.map((m) => (
                <button
                  key={m.id}
                  onClick={() => addStat(m.id)}
                  title={`Add “${m.label}” as a KPI stat`}
                  className="px-2.5 py-1 text-[11px] rounded-md border border-slate-700 hover:bg-slate-800 hover:border-fuchsia-500/40 text-slate-300"
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">Charts — standings & breakdowns</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {breakdowns.map((m) => (
                <button key={m.id} onClick={() => addChart(m.id)} title={m.description} className="px-2.5 py-1 text-[11px] rounded-md border border-slate-700 hover:bg-slate-800 hover:border-cyan-500/40 text-slate-300">
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">Charts — trends over the season</p>
            <div className="flex flex-wrap gap-1.5">
              {trends.map((m) => (
                <button key={m.id} onClick={() => addChart(m.id)} title={m.description} className="px-2.5 py-1 text-[11px] rounded-md border border-slate-700 hover:bg-slate-800 hover:border-cyan-500/40 text-slate-300">
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
              Ask RyAgent to “build me a standings dashboard”, add tiles one at a time, or start from a ready-made set.
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

        {/* Rendered dashboard: KPI band, section headers, chart grid */}
        {tiles.length > 0 && (
          <div className="mt-5 space-y-5">
            {blocks.map((block) => {
              if (block.type === 'stats') {
                return (
                  <div key={block.key} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {block.tiles.map(renderStatCard)}
                  </div>
                );
              }
              if (block.type === 'section') {
                return (
                  <div key={block.key} className="flex items-center gap-3 pt-1">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{block.label}</h3>
                    <div className="h-px flex-1 bg-slate-800" />
                  </div>
                );
              }
              return (
                <div key={block.key} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {block.tiles.map(renderChartCard)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SportsRyAgentPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        tiles={tilesContext}
        onApplyOp={applyOp}
        getSessionId={getSessionId}
      />
    </section>
  );
}
