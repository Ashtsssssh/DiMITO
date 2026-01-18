import { useNetworkStore } from '@/stores/networkStore';
import NetworkOverviewPanel from './NetworkOverviewPanel';
import RoutingPanel from './RoutingPanel';
import TrafficPanel from './TrafficPanel';
import SignalPanel from './SignalPanel';
import AdminPanel from './AdminPanel';
import { X } from 'lucide-react';

export default function SidePanel() {
  const { mode, selectedNodeId, selectNode } = useNetworkStore();

  // Don't show panel if no node selected (except in admin mode)
  if (!selectedNodeId && mode !== 'admin' && mode !== 'network') {
    return null;
  }

  return (
    <div className="w-96 border-l border-border bg-card flex flex-col overflow-hidden shadow-2xl">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-accent/50">
        <h2 className="text-lg font-semibold text-foreground capitalize">
          {mode} {selectedNodeId ? `- ${selectedNodeId}` : ''}
        </h2>
        {selectedNodeId && (
          <button
            onClick={() => selectNode(null)}
            className="p-1 hover:bg-accent rounded transition-colors"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Panel content based on mode */}
      <div className="flex-1 overflow-y-auto p-4">
        {mode === 'network' && <NetworkOverviewPanel />}
        {mode === 'routing' && <RoutingPanel />}
        {mode === 'traffic' && <TrafficPanel />}
        {mode === 'signal' && <SignalPanel />}
        {mode === 'admin' && <AdminPanel />}
      </div>
    </div>
  );
}