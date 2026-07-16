import type { ChartSpec, ChartRow, ChartType } from './RyAgentChart';

/** The governed run spec for one chart tile (mirrors the server VizSpec). */
export type RunSpec = {
  metricId: string;
  chartType?: ChartType;
  filters?: { dimension: string; value: string }[];
  limit?: number;
  sort?: 'asc' | 'desc';
  excludeCategories?: string[];
  includeCategories?: string[];
  color?: string;
  opacity?: number;
  title?: string;
};

/** How wide a tile renders in the grid. */
export type TileSpan = 'full' | 'half';

/** A fully built tile the client can drop straight into the grid. */
export type BuiltTile = { runSpec: RunSpec; chartSpec: ChartSpec; rows: ChartRow[] };

/** Operations the RyAgent Dashboard Builder streams to mutate the live grid. */
export type DashboardOp =
  | { op: 'add'; tile: BuiltTile }
  | { op: 'update'; tileId: string; tile: BuiltTile }
  | { op: 'remove'; tileId: string }
  | { op: 'clear' }
  | { op: 'set_title'; title: string }
  | { op: 'organize'; title?: string; layout: { tileId: string; span?: TileSpan }[] }
  | { op: 'add_filter'; tileId: string; dimension: string }
  | { op: 'remove_filter'; tileId: string; dimension: string };

/** Per-tile context the builder sends to the endpoint so it can target tiles. */
export type TileContext = { tileId: string; label?: string; kind?: 'trend' | 'breakdown'; span?: TileSpan; filterControls?: string[]; spec: RunSpec };
