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
};

/** A fully built tile the client can drop straight into the grid. */
export type BuiltTile = { runSpec: RunSpec; chartSpec: ChartSpec; rows: ChartRow[] };

/** Operations the RyAgent Dashboard Builder streams to mutate the live grid. */
export type DashboardOp =
  | { op: 'add'; tile: BuiltTile }
  | { op: 'update'; tileId: string; tile: BuiltTile }
  | { op: 'remove'; tileId: string }
  | { op: 'clear' };

/** Per-tile context the builder sends to the endpoint so it can target tiles. */
export type TileContext = { tileId: string; label?: string; spec: RunSpec };
