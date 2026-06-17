import { useNetworkStore } from '@/stores/networkStore';
import { Network, Activity, AlertTriangle, TrendingUp } from 'lucide-react';

export default function StatsBar() {
  const { nodes, edges, stats } = useNetworkStore();

  // Calculate basic stats
  const totalNodes = nodes.length;
  const totalEdges = edges.length;
  const avgQueueLength = edges.length > 0
    ? (edges.reduce((sum, e) => sum + e.queueLengthM, 0) / edges.length).toFixed(1)
    : '0';
  const criticalEdges = edges.filter(e => e.queueLengthM > 60).length;

  const statItems = [
    {
      label: 'Intersections',
      value: totalNodes,
      icon: <Network className="w-4 h-4" />,
      color: 'text-blue-500',
    },
    {
      label: 'Connections',
      value: totalEdges,
      icon: <Activity className="w-4 h-4" />,
      color: 'text-green-500',
    },
    {
      label: 'Avg Queue (m)',
      value: avgQueueLength,
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-yellow-500',
    },
    {
      label: 'Critical',
      value: criticalEdges,
      icon: <AlertTriangle className="w-4 h-4" />,
      color: criticalEdges > 0 ? 'text-red-500' : 'text-gray-500',
    },
  ];

  return (
    <div className="border-t border-border bg-card px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        {statItems.map((stat, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className={stat.color}>{stat.icon}</div>
            <div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              <div className="text-sm font-bold text-foreground">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs text-muted-foreground">Live</span>
      </div>
    </div>
  );
}