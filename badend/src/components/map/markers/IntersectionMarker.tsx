import { Node } from '@/types/network';
import { useNetworkStore } from '@/stores/networkStore';
import { cn } from '@/lib/utils';
import { Circle } from 'lucide-react';

interface IntersectionMarkerProps {
  node: Node;
  onClick: () => void;
}

export default function IntersectionMarker({ node, onClick }: IntersectionMarkerProps) {
  const { selectedNodeId, hoveredNodeId, mode } = useNetworkStore();

  const isSelected = selectedNodeId === node.id;
  const isHovered = hoveredNodeId === node.id;
  const hasActiveSignal = !!node.currentGreenEdge;

  // Determine marker color based on mode and state
  const getMarkerColor = () => {
    if (isSelected) return 'rgb(59, 130, 246)'; // blue
    if (hasActiveSignal) return 'rgb(34, 197, 94)'; // green
    return 'rgb(161, 161, 170)'; // gray
  };

  const markerSize = isSelected ? 24 : isHovered ? 20 : 16;

  return (
    <div
      onClick={onClick}
      className="cursor-pointer transition-all duration-200"
      style={{
        transform: `scale(${isSelected ? 1.2 : isHovered ? 1.1 : 1})`,
      }}
    >
      {/* Outer glow for active signals */}
      {hasActiveSignal && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            backgroundColor: getMarkerColor(),
            opacity: 0.3,
            width: markerSize + 12,
            height: markerSize + 12,
            left: -6,
            top: -6,
          }}
        />
      )}

      {/* Main marker circle */}
      <div
        className={cn(
          "rounded-full border-2 border-white shadow-lg flex items-center justify-center",
          "transition-all duration-200"
        )}
        style={{
          backgroundColor: getMarkerColor(),
          width: markerSize,
          height: markerSize,
        }}
      >
        {/* Node ID label */}
        <div className="text-white text-xs font-bold">
          {node.label || node.id.replace('N', '')}
        </div>
      </div>

      {/* Cycle indicator for signal mode */}
      {mode === 'signal' && node.cyclePosition !== undefined && (
        <div
          className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
          style={{ width: markerSize }}
        >
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${node.cyclePosition}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}