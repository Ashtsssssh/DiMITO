import { useState } from 'react';
import { useNetworkStore } from '@/stores/networkStore';
import { recomputeGreen, recomputeRouting, runDVUpdate } from '@/services/api';
import { Play, RefreshCw, Route } from 'lucide-react';

export default function AdminPanel() {
  const { selectedNodeId } = useNetworkStore();
  const [loading, setLoading] = useState<string | null>(null);

  const handleRecomputeGreen = async () => {
    if (!selectedNodeId) return;
    setLoading('green');
    try {
      await recomputeGreen(selectedNodeId);
      alert('Green time recomputed successfully');
    } catch (error) {
      alert('Failed to recompute green time');
    } finally {
      setLoading(null);
    }
  };

  const handleRecomputeRouting = async () => {
    if (!selectedNodeId) return;
    setLoading('routing');
    try {
      await recomputeRouting(selectedNodeId);
      alert('Routing table recomputed successfully');
    } catch (error) {
      alert('Failed to recompute routing');
    } finally {
      setLoading(null);
    }
  };

  const handleDVUpdate = async () => {
    if (!selectedNodeId) return;
    setLoading('dv');
    try {
      await runDVUpdate(selectedNodeId);
      alert('DV update completed successfully');
    } catch (error) {
      alert('Failed to run DV update');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Admin Controls</h3>
        <p className="text-xs text-muted-foreground">
          {selectedNodeId
            ? `Managing ${selectedNodeId}`
            : 'Select a node to manage'}
        </p>
      </div>

      {selectedNodeId && (
        <div className="space-y-2">
          <button
            onClick={handleRecomputeGreen}
            disabled={loading === 'green'}
            className="w-full flex items-center justify-between bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg p-3 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              <span className="text-sm font-semibold">Recompute Green Time</span>
            </div>
            {loading === 'green' && <RefreshCw className="w-4 h-4 animate-spin" />}
          </button>

          <button
            onClick={handleRecomputeRouting}
            disabled={loading === 'routing'}
            className="w-full flex items-center justify-between bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg p-3 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4" />
              <span className="text-sm font-semibold">Recompute Routing</span>
            </div>
            {loading === 'routing' && <RefreshCw className="w-4 h-4 animate-spin" />}
          </button>

          <button
            onClick={handleDVUpdate}
            disabled={loading === 'dv'}
            className="w-full flex items-center justify-between bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg p-3 transition-colors"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm font-semibold">Run DV Update</span>
            </div>
            {loading === 'dv' && <RefreshCw className="w-4 h-4 animate-spin" />}
          </button>
        </div>
      )}

      <div className="pt-4 border-t border-border">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">
          Add New Elements
        </h4>
        <div className="text-xs text-muted-foreground italic">
          Node/Edge creation UI coming soon
        </div>
      </div>
    </div>
  );
}