import { SelectionStats } from "./types";
import { formatInt, formatArea } from "./utils/mapHelpers";

interface SelectionPanelProps {
  selectedIds: Set<string>;
  selectedNTA?: string;
  selectionStats?: SelectionStats | any;
  onClear: () => void;
  onExport: () => void;
}

export default function SelectionPanel({
  selectedIds,
  selectedNTA,
  selectionStats,
  onClear,
  onExport,
}: SelectionPanelProps) {
  if (selectedIds.size === 0 && !selectedNTA) {
    return null;
  }

  const displayStats = selectionStats as any;
  const buildingCount = selectedIds.size;

  return (
    <div className="absolute top-3 right-3 rounded-lg p-4 shadow-lg max-w-sm z-20" style={{ backgroundColor: 'rgba(255, 255, 255, 1)', opacity: 1 }}>
      <h3 className="font-bold mb-3 text-sm text-gray-900" style={{ letterSpacing: '0.01em' }}>Selection</h3>
      
      {selectedNTA && (
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="text-xs text-gray-600 mb-0.5">Neighborhood</div>
          <div className="text-sm font-semibold text-gray-900">{selectedNTA}</div>
          {buildingCount > 0 && (
            <div className="text-xs text-gray-500 mt-1">{formatInt(buildingCount)} buildings</div>
          )}
        </div>
      )}
      
      {!selectedNTA && buildingCount > 0 && (
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="text-xs text-gray-600 mb-0.5">Buildings Selected</div>
          <div className="text-sm font-semibold text-gray-900">{formatInt(buildingCount)}</div>
        </div>
      )}

      {displayStats && (
        <div className="mb-4 space-y-2 text-xs">
          {displayStats.total_area && displayStats.total_area > 0 && (
            <div>
              <div className="text-gray-600 mb-0.5">Total Area</div>
              <div className="font-semibold text-gray-900">{formatArea(displayStats.total_area)}</div>
            </div>
          )}
          {displayStats.total_count && displayStats.total_count > 0 && (
            <div>
              <div className="text-gray-600 mb-0.5">Total Count</div>
              <div className="font-semibold text-gray-900">{formatInt(displayStats.total_count)}</div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onClear}
          className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded text-xs font-medium hover:bg-gray-300 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={onExport}
          className="px-3 py-1.5 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 transition-colors"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
