import { useNetworkStore } from '@/stores/networkStore';
import { useQuery } from '@tanstack/react-query';
import { getRoutingTable } from '@/services/api';

export default function RoutingPanel() {
  const { selectedNodeId } = useNetworkStore();

  const { data: routingTable, isLoading } = useQuery({
    queryKey: ['routing', selectedNodeId],
    queryFn: () => getRoutingTable(selectedNodeId!),
    enabled: !!selectedNodeId,
  });

  if (!selectedNodeId) {
    return (
      <div className="text-sm text-muted-foreground">
        Select a node to view routing table
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading routing table...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">
          Routing Table for {selectedNodeId}
        </h3>
      </div>

      {routingTable?.entries.map((entry) => (
        <div key={entry.destination} className="bg-accent/30 rounded-lg p-3">
          <div className="text-sm font-semibold text-foreground mb-2">
            To: {entry.destination}
          </div>
          <div className="space-y-1">
            {entry.nextHops.map((hop, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">via {hop.via}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${hop.probability * 100}%` }}
                    />
                  </div>
                  <span className="text-foreground font-mono">
                    {(hop.probability * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}