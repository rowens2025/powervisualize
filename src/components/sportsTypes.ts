import type { ChartSpec, ChartRow, ChartType } from './RyAgentChart';
import type { TileSpan } from './dashboardTypes';

/**
 * Client types for the MLB sports dashboard studio. The sports semantic layer
 * returns chart specs shape-compatible with the mortgage ones, so tiles render
 * through the same RyAgentChart.
 */

/** How to combine `metric` and `metric2` into one derived value per team. */
export type SportsDeriveOp = 'ratio' | 'difference' | 'sum' | 'product';

/** The governed run spec for one sports tile (mirrors the server SportsRunSpec). */
export type SportsRunSpec = {
  metric: string;
  season?: number;
  team?: string;
  sort?: 'asc' | 'desc';
  limit?: number;
  chartType?: ChartType;
  color?: string;
  opacity?: number;
  title?: string;
  /**
   * Second metric. When set, this tile combines two metrics:
   * - no `deriveOp` → a combo chart (bars + line on one chart).
   * - with `deriveOp` → a new metric crunched on the fly (single value per team).
   */
  metric2?: string;
  deriveOp?: SportsDeriveOp;
};

/** A fully built tile the client can drop straight into the grid. */
export type BuiltSportsTile = { runSpec: SportsRunSpec; chartSpec: ChartSpec; rows: ChartRow[] };

/** The governed spec for one KPI/stat tile (mirrors the server SportsStatSpec). */
export type SportsStatSpec = {
  metric: string;
  season?: number;
  team?: string;
  sort?: 'asc' | 'desc';
  label?: string;
};

/** A fully built KPI stat (mirrors the server BuiltSportsStat). */
export type BuiltSportsStat = {
  statSpec: SportsStatSpec;
  caption: string;
  entity: string;
  value: number;
  formatted: string;
  sub: string;
  measureLabel: string;
  season?: number;
};

/** One item in an organize layout — chart tiles carry a span, any tile a section. */
export type LayoutItem = { tileId: string; span?: TileSpan; section?: string };

/** Operations the sports RyAgent streams to mutate the live grid. */
export type SportsDashboardOp =
  | { op: 'add'; id?: string; tile: BuiltSportsTile }
  | { op: 'add_stat'; id?: string; stat: BuiltSportsStat }
  | { op: 'update'; tileId: string; tile: BuiltSportsTile }
  | { op: 'update_stat'; tileId: string; stat: BuiltSportsStat }
  | { op: 'remove'; tileId: string }
  | { op: 'clear' }
  | { op: 'set_title'; title: string }
  | { op: 'organize'; title?: string; layout: LayoutItem[] }
  | { op: 'add_filter'; tileId: string; dimension: string }
  | { op: 'refetch' };

/** Per-tile context the panel sends to the endpoint so it can target tiles. */
export type SportsTileContext = {
  tileId: string;
  kind: 'chart' | 'stat';
  label?: string;
  section?: string;
  span?: TileSpan;
  filterControls?: string[];
  /** Present on chart tiles. */
  spec?: SportsRunSpec;
  /** Present on stat tiles. */
  statSpec?: SportsStatSpec;
};

/** A metric entry from /api/sports/meta. */
export type SportsCatalogMetric = {
  id: string;
  label: string;
  description: string;
  kind: 'trend' | 'breakdown';
  chartTypes: ChartType[];
  defaultChart: ChartType;
  dimensions: string[];
  requiresTeam: boolean;
  example: string;
};

/** Warehouse freshness snapshot from /api/sports/query {mode:'status'}. */
export type SportsStatus = {
  games: number;
  teamGames: number;
  latestGameDate: string | null;
  lastIngestedAt: string | null;
  seasons: number[];
};

/** Result of a manual refresh (POST /api/sports-ingest). */
export type IngestSummary = {
  ok: boolean;
  daysScanned: number;
  daysWithGames: number;
  gamesUpserted: number;
  tableTotal: number;
  latestGameDate: string | null;
};
