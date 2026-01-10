import { ScenarioKPIs, SCENARIO_LABELS, KPIData, isKPIData } from "./types";
import { formatInt, formatArea } from "./utils/mapHelpers";

interface SelectionStats {
  total_area?: number;
  total_count?: number;
  area_by?: Record<string, number>;
  count_by?: Record<string, number>;
}

interface KPICardsProps {
  kpiData: ScenarioKPIs;
  scenario: string;
  selectedZone?: string;
  selectionStats?: SelectionStats;
}

export default function KPICards({
  kpiData,
  scenario,
  selectedZone = "New York City",
  selectionStats,
}: KPICardsProps) {
  const label = SCENARIO_LABELS[scenario] || scenario;
  
  // Improved data extraction using type guard
  let data: KPIData | null = null;
  if (kpiData && scenario && scenario !== "__labels__") {
    const scenarioData = kpiData[scenario];
    if (isKPIData(scenarioData)) {
      data = scenarioData;
    } else {
      console.warn(`KPICards: Scenario data for "${scenario}" is not valid KPIData:`, scenarioData);
    }
  } else {
    if (!kpiData) {
      console.warn('KPICards: kpiData is null/undefined');
    }
    if (!scenario) {
      console.warn('KPICards: scenario is empty');
    } else if (scenario === "__labels__") {
      console.warn('KPICards: scenario is "__labels__" which is not a valid scenario');
    }
  }
  
  const displayStats = selectionStats || data;
  
  // Debug logging when data is missing
  if (!data && !selectionStats && kpiData) {
    console.log('KPICards Debug (no data found):', {
      hasKpiData: !!kpiData,
      scenario,
      availableScenarios: kpiData ? Object.keys(kpiData).filter(k => k !== '__labels__') : null,
      scenarioDataType: kpiData && scenario && scenario in kpiData ? typeof kpiData[scenario] : 'N/A',
      scenarioData: kpiData && scenario && scenario in kpiData ? kpiData[scenario] : null
    });
  }

  const renderGrid = (obj: Record<string, number> | undefined, suffix: string = "") => {
    if (!obj || typeof obj !== 'object') {
      return (
        <div className="text-xs text-gray-500">No data available</div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
        {["1", "2", "3", "4", "5"].map((lvl) => (
          <div key={lvl}>
            <div className="font-bold text-gray-700">{lvl}</div>
            <div className="text-gray-900">{formatInt(obj[lvl] || 0)}{suffix}</div>
          </div>
        ))}
      </div>
    );
  };

  if (!kpiData) {
    return (
      <div className="absolute top-3 left-3 flex flex-col gap-2.5 w-[290px] pointer-events-none z-10">
        <div className="bg-white/95 rounded-lg p-3 shadow-lg pointer-events-auto">
          <h4 className="text-xs font-semibold mb-1.5">Loading KPI data...</h4>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-3 left-3 flex flex-col gap-2.5 w-[290px] pointer-events-none z-10">
      <div className="bg-white/95 rounded-lg p-3 shadow-lg pointer-events-auto">
        <h4 className="text-xs font-semibold mb-1.5 text-gray-700">Scenario</h4>
        <div className="text-base font-bold text-gray-900">{label}</div>
      </div>

      <div className="bg-white/95 rounded-lg p-3 shadow-lg pointer-events-auto">
        <h4 className="text-xs font-semibold mb-1.5 text-gray-700">Selected Zone</h4>
        <div className="text-base font-bold text-gray-900">{selectedZone}</div>
      </div>

      {displayStats && typeof displayStats === 'object' && 'total_area' in displayStats ? (
        <>
          <div className="bg-white/95 rounded-lg p-3 shadow-lg pointer-events-auto">
            <h4 className="text-xs font-semibold mb-1.5 text-gray-700">
              Square Footage Buildings Flooded (FVI ≥ 1)
            </h4>
            <div className="text-base font-bold text-gray-900">
              {formatArea(displayStats.total_area || 0)}
            </div>
          </div>

          <div className="bg-white/95 rounded-lg p-3 shadow-lg pointer-events-auto">
            <h4 className="text-xs font-semibold mb-1.5 text-gray-700">
              FVI – Sq. Ft. Buildings Flooded
            </h4>
            {renderGrid(displayStats.area_by, " sq ft")}
          </div>

          <div className="bg-white/95 rounded-lg p-3 shadow-lg pointer-events-auto">
            <h4 className="text-xs font-semibold mb-1.5 text-gray-700">
              Count Buildings Flooded (FVI ≥ 1)
            </h4>
            <div className="text-base font-bold text-gray-900">
              {formatInt(displayStats.total_count || 0)}
            </div>
          </div>

          <div className="bg-white/95 rounded-lg p-3 shadow-lg pointer-events-auto">
            <h4 className="text-xs font-semibold mb-1.5 text-gray-700">
              FVI – Count Buildings Flooded
            </h4>
            {renderGrid(displayStats.count_by)}
          </div>
        </>
      ) : (
        <div className="bg-white/95 rounded-lg p-3 shadow-lg pointer-events-auto border border-yellow-400">
          <h4 className="text-xs font-semibold mb-1.5 text-red-600">⚠️ Data Issue</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Scenario: {scenario}</div>
            <div>Has kpiData: {kpiData ? 'Yes' : 'No'}</div>
            <div>Has data: {data ? 'Yes' : 'No'}</div>
            <div>Has selectionStats: {selectionStats ? 'Yes' : 'No'}</div>
            {kpiData && scenario && <div>kpiData keys: {Object.keys(kpiData).join(', ')}</div>}
            {kpiData && scenario && scenario in kpiData && (
              <div>Scenario data type: {typeof kpiData[scenario]}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
