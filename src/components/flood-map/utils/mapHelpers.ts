import { FVI_COLORS, SCENARIOS } from "../types";

export function fviExprForScenario(scenario: string, hasSelection: boolean = false): any {
  const nonFloodedColor = "rgba(207, 211, 214, 0.25)";
  return [
    "step",
    ["coalesce", ["to-number", ["get", scenario]], 0],
    nonFloodedColor,
    1, FVI_COLORS[1],
    2, FVI_COLORS[2],
    3, FVI_COLORS[3],
    4, FVI_COLORS[4],
    5, FVI_COLORS[5],
  ];
}

export function formatInt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return Math.round(n).toLocaleString();
}

export function formatArea(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `${formatInt(n)} sq ft`;
}
