import { useState, useEffect, useRef } from 'react';
import { routingAPI } from '@/api/api';
import { X, MapPin, Target, Navigation, RefreshCw } from 'lucide-react';

export default function RoutingVisualizer({
  nodes,
  edges,
  showModal = false,
  onModalClose,
  onNodeClickHandler,  // ✅ CHANGED: from onHandlerReady to onNodeClickHandler
  onVisualizationUpdate
}) {
  // STATE
  const [step, setStep] = useState('selectStart'); // 'selectStart' | 'selectDest' | 'viewResult'
  const [startNode, setStartNode] = useState(null);
  const [destNode, setDestNode] = useState(null);
  const [routingTable, setRoutingTable] = useState(null);
  const [routingPaths, setRoutingPaths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // REFS - Keep state accessible to the click handler
  const stateRef = useRef({ step, startNode, destNode, routingTable, nodes, edges });

  // Update state ref whenever state changes
  useEffect(() => {
    stateRef.current = { step, startNode, destNode, routingTable, nodes, edges };
  }, [step, startNode, destNode, routingTable, nodes, edges]);

  // =============================================================================
  // CLICK HANDLER - This function will be called when a node is clicked on the map
  // =============================================================================
  const handleNodeClick = useRef((node) => {
    const state = stateRef.current;
    console.log('[RoutingVisualizer] Node clicked:', node?.node_id, 'Current step:', state.step);

    if (!node) return;

    // STEP 1: User selects starting node
    if (state.step === 'selectStart') {
      console.log('[RoutingVisualizer] Setting start node:', node.node_id);
      setStartNode(node);
      setLoading(true);
      setError(null);

      // Fetch routing table from backend
      routingAPI
        .getRoutingTable(node.node_id)
        .then((data) => {
          console.log('[RoutingVisualizer] ✓ Routing table received:', data);
          setRoutingTable(data);
          setStep('selectDest');
          setLoading(false);
        })
        .catch((err) => {
          console.error('[RoutingVisualizer] ✗ Error fetching routing table:', err);
          setError(err.message);
          setLoading(false);
        });
    }
    // STEP 2: User selects destination node
    else if (state.step === 'selectDest') {
      console.log('[RoutingVisualizer] Setting destination node:', node.node_id);
      setDestNode(node);
      calculateRoutingPaths(node.node_id, state);
    }
  }).current;

  // =============================================================================
  // CALCULATE ROUTING PATHS - Uses cached routing table
  // =============================================================================
  const calculateRoutingPaths = (destinationNodeId, state) => {
    if (!state.routingTable?.routing_table) {
      console.log('[RoutingVisualizer] No routing table available');
      setRoutingPaths([]);
      onVisualizationUpdate?.(null);
      return;
    }

    const routesForDest = state.routingTable.routing_table[destinationNodeId];

    if (!routesForDest || routesForDest.length === 0) {
      console.log('[RoutingVisualizer] No routes found for destination:', destinationNodeId);
      setRoutingPaths([]);
      onVisualizationUpdate?.(null);
      return;
    }

    // Find all outgoing edges from the start node
    const outgoingEdges = state.edges.filter((e) => e.in_node_id === state.startNode.node_id);

    // Match edges with routing table entries
    const paths = outgoingEdges
      .map((edge) => {
        const route = routesForDest.find((r) => r.next_hop === edge.out_node_id);
        const nextHopNode = state.nodes.find((n) => n.node_id === edge.out_node_id);
        
        return {
          edge: edge.edge_id,
          nextHop: edge.out_node_id,
          nextHopName: nextHopNode?.name || edge.out_node_id,
          probability: route ? route.prob : 0,
          percentageStr: `${((route ? route.prob : 0) * 100).toFixed(1)}%`,
        };
      })
      .filter((p) => p.probability > 0)
      .sort((a, b) => b.probability - a.probability);

    console.log('[RoutingVisualizer] Calculated paths:', paths);
    setRoutingPaths(paths);
    setStep('viewResult');

    // Send visualization data to MapView
    onVisualizationUpdate?.({
      startNodeId: state.startNode.node_id,
      destNodeId: destinationNodeId,
      paths: paths,
    });
  };

  // =============================================================================
  // REGISTER CLICK HANDLER - Called once when modal opens
  // =============================================================================
  useEffect(() => {
    if (showModal && onNodeClickHandler) {
      console.log('[RoutingVisualizer] Registering click handler');
      onNodeClickHandler(handleNodeClick);
    }

    // Cleanup when modal closes
    return () => {
      if (!showModal && onNodeClickHandler) {
        console.log('[RoutingVisualizer] Unregistering click handler');
        onNodeClickHandler(null);
      }
    };
  }, [showModal, onNodeClickHandler]);

  // =============================================================================
  // UI HANDLERS
  // =============================================================================
  const handleChangeDest = () => {
    console.log('[RoutingVisualizer] Changing destination');
    setDestNode(null);
    setRoutingPaths([]);
    setStep('selectDest');
    onVisualizationUpdate?.(null);
  };

  const handleReset = () => {
    console.log('[RoutingVisualizer] Resetting analyzer');
    setStep('selectStart');
    setStartNode(null);
    setDestNode(null);
    setRoutingTable(null);
    setRoutingPaths([]);
    setError(null);
    setLoading(false);
    onVisualizationUpdate?.(null);
  };

  const handleClose = () => {
    handleReset();
    onModalClose?.();
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

  return (
    <>
      {/* =================================================================== */}
      {/* STEP 1: SELECT START NODE - Top Banner                              */}
      {/* =================================================================== */}
      {step === 'selectStart' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md mx-4">
          <div className="bg-gradient-to-r from-violet-600 to-blue-600 border border-violet-400 rounded-lg p-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6 text-white flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-white font-bold text-base">🚦 Step 1: Select Starting Node</h3>
                <p className="text-violet-100 text-sm">Click any node on the map to begin</p>
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
                <p className="text-white text-sm font-medium">Fetching routing table...</p>
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

      {/* =================================================================== */}
      {/* STEP 2: SELECT DESTINATION - Top Banner                             */}
      {/* =================================================================== */}
      {step === 'selectDest' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md mx-4">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 border border-blue-400 rounded-lg p-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-white flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-white font-bold text-base">🎯 Step 2: Select Destination</h3>
                <p className="text-blue-100 text-sm">Click any node to view routing probabilities</p>
              </div>
              <button
                onClick={handleClose}
                className="text-white hover:bg-white/20 p-1.5 rounded transition flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 bg-white/10 rounded-lg p-3">
              <p className="text-white text-sm">
                📍 <strong>Starting from:</strong> {startNode?.name || startNode?.node_id}
              </p>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STEP 3: SHOW RESULTS - Full Modal                                   */}
      {/* =================================================================== */}
      {step === 'viewResult' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-4 flex items-center justify-between border-b border-zinc-700">
              <div className="flex items-center gap-3">
                <Navigation className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">🛣️ Routing Analysis Results</h2>
              </div>
              <button 
                onClick={handleClose} 
                className="text-white hover:bg-white/20 p-2 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Route Info */}
              <div className="bg-gradient-to-r from-violet-900/30 to-blue-900/30 border border-violet-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Route</p>
                    <p className="text-white text-lg font-semibold">
                      <span className="text-violet-400">{startNode?.name || startNode?.node_id}</span>
                      {' → '}
                      <span className="text-blue-400">{destNode?.name || destNode?.node_id}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Next Hop Probabilities */}
              <div>
                <h3 className="text-white font-semibold text-lg mb-3">Next Hop Probabilities</h3>
                
                {routingPaths.length === 0 ? (
                  <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                    <p className="text-yellow-300 text-sm">⚠️ No routes available to this destination</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {routingPaths.map((path, idx) => (
                      <div 
                        key={idx} 
                        className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-white font-medium text-base">
                              → <span className="text-orange-400">{path.nextHopName}</span>
                            </p>
                            <p className="text-gray-500 text-xs mt-1">Edge: {path.edge}</p>
                          </div>
                          <div className="text-right">
                            <div
                              className={`text-3xl font-bold ${
                                path.probability > 0.5
                                  ? 'text-green-400'
                                  : path.probability > 0.33
                                    ? 'text-yellow-400'
                                    : 'text-gray-400'
                              }`}
                            >
                              {path.percentageStr}
                            </div>
                            <p className="text-gray-500 text-xs mt-1">probability</p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="bg-zinc-700 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              path.probability > 0.5
                                ? 'bg-gradient-to-r from-green-500 to-green-400'
                                : path.probability > 0.33
                                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                                  : 'bg-gradient-to-r from-gray-500 to-gray-400'
                            }`}
                            style={{ width: `${path.probability * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-zinc-800 border-t border-zinc-700 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={handleChangeDest}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2"
              >
                <Target className="w-4 h-4" />
                Change Destination
              </button>
              <button
                onClick={handleReset}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Start Over
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