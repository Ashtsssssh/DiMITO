import { useNetworkStore } from '@/stores/networkStore';

export default function NetworkOverviewPanel() {
  const { nodes, edges } = useNetworkStore();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Network Overview</h3>
        <p className="text-sm text-muted-foreground">
          Click on any intersection to view details
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-accent/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-foreground">{nodes.length}</div>
          <div className="text-xs text-muted-foreground">Intersections</div>
        </div>
        <div className="bg-accent/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-foreground">{edges.length}</div>
          <div className="text-xs text-muted-foreground">Connections</div>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">Recent Activity</h4>
        <div className="text-xs text-muted-foreground italic">
          No recent activity
        </div>
      </div>
    </div>
  );
}