import { useNetworkStore } from '@/stores/networkStore';
import { getTrafficColor } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function TrafficPanel() {
  const { selectedNodeId, edges } = useNetworkStore();

  if (!selectedNodeId) {
    return (
      <div className="text-sm text-muted-foreground">
        Select a node to view traffic details
      </div>
    );
  }

  // Get edges connected to this node
  const connectedEdges = edges.filter(
    (e) => e.source === selectedNodeId || e.target === selectedNodeId
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">
          Traffic at {selectedNodeId}
        </h3>
      </div>

      {connectedEdges.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">
          No connected edges
        </div>
      ) : (
        connectedEdges.map((edge) => (
          <div key={edge.id} className="bg-accent/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                {edge.source} → {edge.target}
              </div>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getTrafficColor(edge.queueLengthM) }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Queue Length</div>
                <div className="text-foreground font-bold">{edge.queueLengthM.toFixed(1)}m</div>
              </div>
              <div>
                <div className="text-muted-foreground">Vehicles</div>
                <div className="text-foreground font-bold">{edge.vehicleCount}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Density</div>
                <div className="text-foreground font-bold">{edge.density.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Pressure</div>
                <div className="text-foreground font-bold">{edge.pressure.toFixed(2)}</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}