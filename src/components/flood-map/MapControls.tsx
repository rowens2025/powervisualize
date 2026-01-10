import { SCENARIO_LABELS, SCENARIOS } from "./types";

interface MapControlsProps {
  scenario: string;
  onScenarioChange: (scenario: string) => void;
  showBuildings: boolean;
  onToggleBuildings: () => void;
  showFloodzones: boolean;
  onToggleFloodzones: () => void;
  showNTA: boolean;
  onToggleNTA: () => void;
  lassoMode?: boolean;
  onToggleLasso?: () => void;
}

export default function MapControls({
  scenario,
  onScenarioChange,
  showBuildings,
  onToggleBuildings,
  showFloodzones,
  onToggleFloodzones,
  showNTA,
  onToggleNTA,
  lassoMode = false,
  onToggleLasso,
}: MapControlsProps) {
  return (
    <div className="absolute top-3 right-3 rounded-lg p-3 shadow-lg max-w-[380px] z-10 text-xs" style={{ backgroundColor: 'rgba(255, 255, 255, 1)', opacity: 1 }}>
      <div className="mb-3">
        <div className="font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.02em' }}>Filters</div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="font-semibold mb-1.5 text-gray-700" style={{ letterSpacing: '0.01em' }}>Scenario</div>
          <select
            value={scenario}
            onChange={(e) => onScenarioChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs text-gray-900 bg-white transition-colors hover:border-gray-400"
            style={{ transition: 'border-color 200ms' }}
          >
            {SCENARIOS.map((key) => (
              <option key={key} value={key}>
                {SCENARIO_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="font-semibold mb-1.5 text-gray-700" style={{ letterSpacing: '0.01em' }}>Layers</div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-gray-800">
              <input
                type="checkbox"
                checked={showBuildings}
                onChange={onToggleBuildings}
                className="cursor-pointer"
              />
              <span>🏢</span>
              <span>Buildings</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none text-gray-800">
              <input
                type="checkbox"
                checked={showFloodzones}
                onChange={onToggleFloodzones}
                className="cursor-pointer"
              />
              <span>🌊</span>
              <span>Flood Zones</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none text-gray-800">
              <input
                type="checkbox"
                checked={showNTA}
                onChange={onToggleNTA}
                className="cursor-pointer"
              />
              <span>🗺</span>
              <span>NTA Outlines</span>
            </label>
          </div>
        </div>

        {onToggleLasso && (
          <div>
            <div className="font-semibold mb-1.5 text-gray-700" style={{ letterSpacing: '0.01em' }}>Selection Tools</div>
            <label className="flex items-center gap-2 cursor-pointer select-none text-gray-800">
              <input
                type="checkbox"
                checked={lassoMode}
                onChange={onToggleLasso}
                className="cursor-pointer"
              />
              <span>✂️</span>
              <span>Lasso Tool</span>
            </label>
          </div>
        )}
      </div>

      <div className="h-px bg-gray-200 my-3" />

      <div className="text-xs text-gray-600 leading-relaxed">
        <div className="font-medium mb-1.5 text-gray-700">Selection Tips:</div>
        <div className="space-y-0.5 text-xs">
          <div>• Click buildings to inspect</div>
          <div>• Click empty space to deselect</div>
          <div>• Use lasso for custom selection</div>
          <div>• Click NTA outlines for neighborhood</div>
        </div>
      </div>
    </div>
  );
}
