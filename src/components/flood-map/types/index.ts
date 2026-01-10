export interface KPIData {
  total_area: number;
  total_count: number;
  area_by: Record<string, number>;
  count_by: Record<string, number>;
}

export type ScenarioKPIs = Record<string, KPIData | Record<string, string>> & {
  __labels__?: Record<string, string>;
}

export function isKPIData(obj: unknown): obj is KPIData {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.total_area === 'number' &&
    typeof candidate.total_count === 'number' &&
    typeof candidate.area_by === 'object' &&
    candidate.area_by !== null &&
    !Array.isArray(candidate.area_by) &&
    typeof candidate.count_by === 'object' &&
    candidate.count_by !== null &&
    !Array.isArray(candidate.count_by)
  );
}

export interface BuildingFeature {
  properties: {
    objectid: string;
    NTACode?: string;
    NTAName?: string;
    boroname?: string;
    geom_area_sqft?: number;
    construction_year?: number;
    [scenario: string]: any;
  };
}

export interface SelectionStats {
  count: number;
  totalArea: number;
  avgFVI?: number;
  fviDistribution?: Record<string, number>;
  topBuildings?: Array<{
    objectid: string;
    NTAName?: string;
    fvi: number;
    area: number;
  }>;
}

export const SCENARIO_LABELS: Record<string, string> = {
  ss_cur: "Storm Surge (Present)",
  ss_50s: "Storm Surge (2050s)",
  ss_80s: "Storm Surge (2080s)",
  tid_20s: "Tidal Flooding (2020s)",
  tid_50s: "Tidal Flooding (2050s)",
  tid_80s: "Tidal Flooding (2080s)",
};

export const SCENARIOS = Object.keys(SCENARIO_LABELS);

export const FVI_COLORS = {
  0: "#cfd3d6",
  1: "#f7e35f",
  2: "#f5b64c",
  3: "#f08a3c",
  4: "#ea5a2a",
  5: "#e53935",
};

export const COLOR_FLOODZONE_FILL = "rgba(80, 160, 255, 0.45)";
export const COLOR_FLOODZONE_OUTLINE = "rgba(60, 130, 220, 0.75)";
export const COLOR_NTA_OUTLINE = "rgba(255, 255, 255, 0.4)";
export const COLOR_SELECTED_OUTLINE = "rgba(255, 215, 0, 1)";
