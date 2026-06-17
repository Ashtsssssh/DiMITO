import { useNetworkStore } from '@/stores/networkStore';
import { useQuery } from '@tanstack/react-query';
import { getSignalState } from '@/services/api';
import { Circle } from 'lucide-react';

export default function SignalPanel() {
  const { selectedNodeId, edges } = useNetworkStore();

  const { data: signalState, isLoading } = useQuery({
    queryKey: ['signal', selectedNodeId],
    queryFn: () => getSignalState(selectedNodeId!),
    enabled: !!selectedNodeId,
    refetchInterval: 1000, // Refetch every second for live updates
  });

  if (!selectedNodeId) {
    return (
      <div className="text-sm text-muted-foreground">
        Select a node to view signal timing
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading signal state...</div>;
  }

  const connectedEdges = edges.filter(e => e.target === selectedNodeId);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">
          Signal Control - {selectedNodeId}
        </h3>
      </div>

      {/* Cycle progress */}
      {signalState?.cyclePosition !== undefined && (
        <div className="bg-accent/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-2">Cycle Progress</div>
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-1000"
              style={{ width: `${signalState.cyclePosition}%` }}
            />
          </div>
          <div className="text-xs text-right text-foreground mt-1">
            {signalState.cyclePosition.toFixed(0)}%
          </div>
        </div>
      )}

      {/* Approach states */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">Approaches</div>
        {connectedEdges.map((edge) => {
          const isGreen = edge.id === signalState?.currentGreen;
          return (
            <div
              key={edge.id}
              className="flex items-center justify-between bg-accent/30 rounded-lg p-3"
            >
              <div className="flex items-center gap-2">
                <Circle
                  className="w-3 h-3"
                  fill={isGreen ? '#10b981' : '#ef4444'}
                  color={isGreen ? '#10b981' : '#ef4444'}
                />
                <span className="text-sm text-foreground">{edge.id}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {isGreen ? (
                  <span className="text-green-500 font-bold">GREEN</span>
                ) : (
                  <span className="text-red-500">RED</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}