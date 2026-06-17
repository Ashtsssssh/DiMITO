import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Activity, Clock, RefreshCw } from 'lucide-react';
import { signalAPI } from '../api/api';

export default function SignalScheduleVisualizer({
  nodes,
  edges,
  showModal = false,
  onModalClose,
  onNodeClickHandler,
  onSignalVisualizationUpdate
}) {
  // STATE
  const [selectedNode, setSelectedNode] = useState(null);
  const [signalState, setSignalState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);

  // REFS
  const timerRef = useRef(null);
  const fetchingRef = useRef(false);

  // =============================================================================
  // FETCH SIGNAL STATE (uses signalAPI from api.js)
  // =============================================================================
  const fetchSignalState = useCallback(async (nodeId, { silent = false } = {}) => {
    // Guard against overlapping fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      if (!silent) { setLoading(true); setError(null); }

      const data = await signalAPI.getSignalState(nodeId);
      data.localFetchTime = Math.floor(Date.now() / 1000);

      console.log('[Signal] fetched:', data);

      setSignalState(prev => {
        // If same edge and current timer still running, keep the existing timer
        if (prev && prev.current_green === data.current_green && remainingTime > 0) {
          return { ...prev, phases: data.phases };
        }
        // Edge changed or first fetch — accept new data
        return data;
      });

      // Only reset remainingTime if edge changed
      setRemainingTime(prevRem => {
        // No previous state => use new data
        if (!signalState) return data.remaining_time;
        // Edge changed => use new remaining
        if (signalState.current_green !== data.current_green) return data.remaining_time;
        // Same edge, timer still running => keep existing
        if (prevRem > 0) return prevRem;
        return data.remaining_time;
      });

      onSignalVisualizationUpdate?.({
        nodeId,
        currentGreen: data.current_green,
        phases: data.phases,
        remainingTime: data.remaining_time,
      });

      if (!silent) setLoading(false);
    } catch (err) {
      console.error('[Signal] fetch error:', err);
      setError(err.message);
      if (!silent) setLoading(false);
    } finally {
      fetchingRef.current = false;
    }
  }, [onSignalVisualizationUpdate, signalState, remainingTime]);

  // =============================================================================
  // NODE CLICK HANDLER
  // =============================================================================
  const handleNodeClick = useRef((node) => {
    console.log('[SignalScheduleVisualizer] Node clicked:', node?.node_id);
    
    if (!node) return;
    
    setSelectedNode(node);
    fetchSignalState(node.node_id);
  }).current;

  // =============================================================================
  // REGISTER CLICK HANDLER
  // =============================================================================
  useEffect(() => {
    if (showModal && onNodeClickHandler) {
      console.log('[SignalScheduleVisualizer] Registering click handler');
      onNodeClickHandler(handleNodeClick);
    }

    return () => {
      if (!showModal && onNodeClickHandler) {
        console.log('[SignalScheduleVisualizer] Unregistering click handler');
        onNodeClickHandler(null);
      }
    };
  }, [showModal, onNodeClickHandler]);

  // =============================================================================
  // COUNTDOWN TIMER
  // =============================================================================
  useEffect(() => {
    if (!signalState || !selectedNode) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - signalState.localFetchTime;
      const remaining = Math.max(0, signalState.remaining_time - elapsed);

      setRemainingTime(remaining);

      onSignalVisualizationUpdate?.({
        nodeId: selectedNode.node_id,
        currentGreen: signalState.current_green,
        phases: signalState.phases,
        remainingTime: remaining,
      });

      // Refetch when countdown reaches 0 — backend walks the cycle
      // forward so we'll get the next edge automatically
      if (remaining <= 0) {
        fetchSignalState(selectedNode.node_id, { silent: true });
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [signalState, selectedNode, fetchSignalState, onSignalVisualizationUpdate]);

  // =============================================================================
  // UI HANDLERS
  // =============================================================================
  const handleReset = () => {
    setSelectedNode(null);
    setSignalState(null);
    setRemainingTime(0);
    setError(null);
    fetchingRef.current = false;

    if (timerRef.current) clearInterval(timerRef.current);

    onSignalVisualizationUpdate?.(null);
  };

  const handleClose = () => {
    handleReset();
    onModalClose?.();
  };

  const handleRefresh = () => {
    if (selectedNode) {
      fetchSignalState(selectedNode.node_id);
    }
  };

  // Reset when modal closes
  useEffect(() => {
    if (!showModal) {
      handleReset();
    }
  }, [showModal]);

  // =============================================================================
  // RENDER
  // =============================================================================
  if (!showModal) {
    return null;
  }

  const isAlert = remainingTime <= 5;

  return (
    <>
      {/* SELECT NODE BANNER */}
      {!selectedNode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md mx-4">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 border border-green-400 rounded-lg p-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-white flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-white font-bold text-base">🚦 Select Node for Signal Schedule</h3>
                <p className="text-green-100 text-sm">Click any node on the map</p>
              </div>
              <button
                onClick={handleClose}
                className="text-white hover:bg-white/20 p-1.5 rounded transition flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loading && (
              <div className="mt-4 bg-white/10 rounded-lg p-3 text-center">
                <div className="inline-block animate-spin text-3xl mb-2">⏳</div>
                <p className="text-white text-sm font-medium">Loading signal schedule...</p>
              </div>
            )}

            {error && (
              <div className="mt-3 bg-red-900/50 border border-red-500 rounded-lg p-3">
                <p className="text-red-200 text-sm">❌ <strong>Error:</strong> {error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SIGNAL SCHEDULE MODAL */}
      {selectedNode && signalState && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between border-b border-zinc-700">
              <div className="flex items-center gap-3">
                <Activity className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">🚦 Signal Schedule</h2>
                  <p className="text-green-100 text-sm">{selectedNode.name || selectedNode.node_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition"
                  title="Refresh"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleClose} 
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Current Status */}
              <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Current Green Signal</p>
                    <p className="text-white text-xl font-bold">{signalState.current_green}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Time Remaining</p>
                    <div className={`text-5xl font-bold ${
                      isAlert 
                        ? 'text-red-400 animate-pulse' 
                        : 'text-green-400'
                    }`}>
                      {Math.ceil(remainingTime)}s
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 bg-zinc-800 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      isAlert
                        ? 'bg-gradient-to-r from-red-500 to-orange-500'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                    }`}
                    style={{
                      width: `${(remainingTime / signalState.remaining_time) * 100}%`
                    }}
                  />
                </div>
              </div>

              {/* All Phases */}
              <div>
                <h3 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Signal Phases
                </h3>
                
                <div className="space-y-2">
                  {signalState.phases.map((phase, idx) => {
                    const isActive = phase.edge === signalState.current_green;
                    const edgeObj = edges.find(e => e.edge_id === phase.edge);
                    const destNode = nodes.find(n => n.node_id === edgeObj?.in_node_id);
                    
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg p-4 transition-all ${
                          isActive
                            ? 'bg-green-600 border-2 border-green-400 scale-105 shadow-lg'
                            : 'bg-zinc-800 border border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Status Indicator */}
                            <div className={`w-4 h-4 rounded-full ${
                              isActive 
                                ? 'bg-green-300 animate-pulse' 
                                : 'bg-red-500'
                            }`} />
                            
                            <div>
                              <p className={`font-medium ${
                                isActive ? 'text-white' : 'text-gray-300'
                              }`}>
                                {phase.edge}
                              </p>
                              {destNode && (
                                <p className={`text-xs ${
                                  isActive ? 'text-green-100' : 'text-gray-500'
                                }`}>
                                  → {destNode.name || destNode.node_id}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`text-2xl font-bold ${
                              isActive ? 'text-white' : 'text-gray-400'
                            }`}>
                              {phase.green}s
                            </div>
                            <p className={`text-xs ${
                              isActive ? 'text-green-100' : 'text-gray-500'
                            }`}>
                              green time
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Info */}
              {isAlert && (
                <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4">
                  <p className="text-orange-300 text-sm flex items-center gap-2">
                    <span className="text-xl">⚠️</span>
                    <span>
                      Signal change imminent! New schedule will be fetched automatically.
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-zinc-800 border-t border-zinc-700 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={handleReset}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
              >
                Select Different Node
              </button>
              <button
                onClick={handleClose}
                className="px-5 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}