import { useState, useCallback, useEffect, useRef } from 'react';
import Map, { NavigationControl, Marker, Source, Layer } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapView({
  clickEnabled,
  onMapClick,
  markerPosition,
  onNodeSelect,
  selectMode,
  selectedNodeForEdit,
  refetchTrigger,
  selectedEdgeNodes,
  onEdgeNodeSelect,
  selectEdgeMode,
  onEdgeSelect,
  selectedEdge,
  routingStartNode,
  onRoutingStartNodeSelect,
  routingDestNode,
  onRoutingDestNodeSelect,
  onNodesUpdate,
  onEdgesUpdate,
  signalStates,
  routingVisualizationData,
  routingNodeClickHandler,      // Handler from RoutingVisualizer
  signalNodeClickHandler,        // ✅ NEW: Handler from SignalScheduleVisualizer
  signalVisualizationData        // ✅ NEW: Signal visualization data
}) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [zoom, setZoom] = useState(12);
  const mapRef = useRef(null);

  /* -------------------------------------------------
     HELPERS
  -------------------------------------------------- */
  const isEdgeGreen = (edge) => {
    // Priority 1: Signal Schedule Visualizer (single node focus)
    if (signalVisualizationData?.currentGreen === edge.edge_id) {
      return true;
    }
    
    // Priority 2: Global signal states (from Page2)
    if (!signalStates) return false;
    const signal = signalStates[edge.out_node_id];
    if (!signal) return false;
    return signal.current_green === edge.edge_id;
  };

  const isEdgeInRoutingPath = (edge) => {
    if (!routingVisualizationData?.paths) return false;
    return routingVisualizationData.paths.some(p => p.edge === edge.edge_id);
  };

  /* -------------------------------------------------
     FETCH DATA
  -------------------------------------------------- */
  useEffect(() => {
    fetchNodes();
    fetchEdges();
  }, [refetchTrigger]);

  const fetchNodes = async () => {
    try {
      setLoading(true);
      console.log('[MapView] Fetching nodes...');
      const res = await fetch('http://localhost:8000/api/node/get_all');
      console.log('[MapView] Nodes response:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[MapView] Nodes data:', data);
        setNodes(data);
        onNodesUpdate?.(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchEdges = async () => {
    console.log('[MapView] Fetching edges...');
    const res = await fetch('http://localhost:8000/api/edge/get_all');
    console.log('[MapView] Edges response:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('[MapView] Edges data length:', data.length);
      setEdges(data);
      onEdgesUpdate?.(data);
    }
  };

  /* -------------------------------------------------
     NODE CLICK HANDLER - Routes to appropriate handler
  -------------------------------------------------- */
  const handleNodeClick = useCallback((node) => {
    console.log('[MapView] Node clicked:', node.node_id);
    console.log('[MapView] signalNodeClickHandler exists:', !!signalNodeClickHandler);
    console.log('[MapView] routingNodeClickHandler exists:', !!routingNodeClickHandler);
    console.log('[MapView] selectEdgeMode:', selectEdgeMode);

    // Priority 1: Signal Schedule Visualizer (if active)
    if (signalNodeClickHandler) {
      console.log('[MapView] → Signal handler');
      signalNodeClickHandler(node);
      return;
    }

    // Priority 2: Routing analyzer (if active)
    if (routingNodeClickHandler) {
      console.log('[MapView] → Routing handler');
      routingNodeClickHandler(node);
      return;
    }

    // Priority 3: Edge selection mode
    if (selectEdgeMode && onEdgeNodeSelect) {
      console.log('[MapView] → Edge selection handler');
      onEdgeNodeSelect(node);
      return;
    }

    // Priority 4: Normal node selection
    if (onNodeSelect) {
      console.log('[MapView] → Normal node select handler');
      onNodeSelect(node);
      return;
    }

    console.log('[MapView] → No handler available');
  }, [signalNodeClickHandler, routingNodeClickHandler, selectEdgeMode, onEdgeNodeSelect, onNodeSelect]);

  /* -------------------------------------------------
     MAP EVENTS
  -------------------------------------------------- */
  const handleMapClick = useCallback((event) => {
    if (clickEnabled && onMapClick) {
      const { lng, lat } = event.lngLat;
      onMapClick({ lng, lat });
    }
  }, [clickEnabled, onMapClick]);

  const handleMapMouseMove = useCallback((event) => {
    if (!mapRef.current) return;

    const features = event.features || [];
    const edgeFeature = features.find(f => f.layer?.id === 'edge-layer');

    if (edgeFeature && !selectEdgeMode) {
      const edge = edges.find(e => e.edge_id === edgeFeature.properties.edge_id);
      if (edge && hoveredEdge?.edge_id !== edge.edge_id) {
        if (hoveredEdge) {
          mapRef.current.setFeatureState(
            { source: 'edges', id: hoveredEdge.edge_id },
            { isHovered: false }
          );
        }
        mapRef.current.setFeatureState(
          { source: 'edges', id: edge.edge_id },
          { isHovered: true }
        );
        setHoveredEdge(edge);
      }
    } else if (hoveredEdge) {
      mapRef.current.setFeatureState(
        { source: 'edges', id: hoveredEdge.edge_id },
        { isHovered: false }
      );
      setHoveredEdge(null);
    }
  }, [edges, hoveredEdge, selectEdgeMode]);

  const handleMapMouseLeave = useCallback(() => {
    if (hoveredEdge && mapRef.current) {
      mapRef.current.setFeatureState(
        { source: 'edges', id: hoveredEdge.edge_id },
        { isHovered: false }
      );
      setHoveredEdge(null);
    }
  }, [hoveredEdge]);

  /* -------------------------------------------------
     MAPBOX FEATURE STATE (SELECT / HOVER / GREEN / ROUTING)
  -------------------------------------------------- */
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || edges.length === 0) return;

    edges.forEach(edge => {
      mapRef.current.setFeatureState(
        { source: 'edges', id: edge.edge_id },
        {
          isGreen: isEdgeGreen(edge),
          isSelected: selectedEdgeId === edge.edge_id || selectedEdge?.edge_id === edge.edge_id,
          isHovered: hoveredEdge?.edge_id === edge.edge_id,
          isRoutingActive: isEdgeInRoutingPath(edge)
        }
      );
    });
  }, [
    edges,
    hoveredEdge,
    selectedEdgeId,
    selectedEdge,
    mapLoaded,
    signalStates,
    signalVisualizationData,  // ✅ NEW: Trigger update when signal viz changes
    routingVisualizationData
  ]);

  /* -------------------------------------------------
     GEOJSON
  -------------------------------------------------- */
  const edgeGeoJSON = {
    type: 'FeatureCollection',
    features: edges.map(edge => {
      const s = nodes.find(n => n.node_id === edge.in_node_id);
      const t = nodes.find(n => n.node_id === edge.out_node_id);
      if (!s?.location || !t?.location) return null;
      return {
        type: 'Feature',
        id: edge.edge_id,
        properties: { edge_id: edge.edge_id },
        geometry: {
          type: 'LineString',
          coordinates: [
            [s.location.lng, s.location.lat],
            [t.location.lng, t.location.lat]
          ]
        }
      };
    }).filter(Boolean)
  };

  // Routing labels GeoJSON
  const routingLabelsGeoJSON = {
    type: 'FeatureCollection',
    features: !routingVisualizationData?.paths || routingVisualizationData.paths.length === 0
      ? []
      : routingVisualizationData.paths.map(path => {
        const s = nodes.find(n => n.node_id === routingVisualizationData.startNodeId);
        const t = nodes.find(n => n.node_id === path.nextHop);
        if (!s?.location || !t?.location) return null;

        const midLng = (s.location.lng + t.location.lng) / 2;
        const midLat = (s.location.lat + t.location.lat) / 2;

        return {
          type: 'Feature',
          id: path.edge,
          properties: {
            edge_id: path.edge,
            probability: path.probability,
            label: path.percentageStr
          },
          geometry: {
            type: 'Point',
            coordinates: [midLng, midLat]
          }
        };
      }).filter(Boolean)
  };

  /* -------------------------------------------------
     RENDER
  -------------------------------------------------- */
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: 77.2177, latitude: 28.6304, zoom: 12 }}
        onZoom={(e) => setZoom(e.viewState.zoom)}
        onLoad={() => setMapLoaded(true)}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        onClick={handleMapClick}
        onMouseMove={handleMapMouseMove}
        onMouseLeave={handleMapMouseLeave}
        interactiveLayerIds={['edge-layer']}
      >
        <NavigationControl position="top-right" />

        {/* RENDER NODES */}
        {!loading && nodes.map(node => {
          if (!node?.location?.lng || !node?.location?.lat) return null;
          
          // Get signal state (global or from signal visualizer)
          const signal = signalVisualizationData?.nodeId === node.node_id 
            ? signalVisualizationData 
            : signalStates?.[node.node_id];
          
          const remaining = signalVisualizationData?.nodeId === node.node_id
            ? signalVisualizationData.remainingTime
            : signal?.remainingComputed ?? signal?.remaining_time ?? 0;
          
          const isAlert = remaining < 10;
          
          const baseSize = 3;
          const nodeSize = Math.max(12, Math.min(24, baseSize * zoom));

          // Highlight nodes for different modes
          const isRoutingStart = routingVisualizationData?.startNodeId === node.node_id;
          const isRoutingDest = routingVisualizationData?.destNodeId === node.node_id;
          const isSignalSelected = signalVisualizationData?.nodeId === node.node_id;

          return (
            <Marker
              key={node.node_id}
              longitude={node.location.lng}
              latitude={node.location.lat}
              anchor="center"
            >
              <div
                onClick={() => handleNodeClick(node)}
                className={`flex flex-col items-center cursor-pointer transition-transform hover:scale-110`}
              >
                {/* Node Circle */}
                <div
                  style={{
                    width: `${nodeSize}px`,
                    height: `${nodeSize}px`,
                    fontSize: `${Math.max(8, nodeSize * 0.5)}px`
                  }}
                  className={`rounded-full flex items-center justify-center font-bold text-white border-2 ${
                    isSignalSelected
                      ? 'bg-green-600 border-green-400 ring-4 ring-green-300'
                      : isRoutingStart
                        ? 'bg-violet-600 border-violet-400 ring-4 ring-violet-300'
                        : isRoutingDest
                          ? 'bg-blue-600 border-blue-400 ring-4 ring-blue-300'
                          : isAlert
                            ? 'bg-red-600 border-red-400'
                            : 'bg-blue-600 border-blue-400'
                  }`}
                >
                </div>

                {/* Labels */}
                {isSignalSelected && (
                  <div className="mt-1 px-2 py-0.5 bg-green-600 text-white text-xs font-bold rounded">
                    SIGNAL
                  </div>
                )}
                {isRoutingStart && !isSignalSelected && (
                  <div className="mt-1 px-2 py-0.5 bg-violet-600 text-white text-xs font-bold rounded">
                    START
                  </div>
                )}
                {isRoutingDest && !isSignalSelected && (
                  <div className="mt-1 px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">
                    DEST
                  </div>
                )}

                {/* Signal Time Label */}
                {signal && !isRoutingStart && !isRoutingDest && (
                  <div 
                    style={{ fontSize: `${Math.max(10, nodeSize * 0.4)}px` }}
                    className={`font-bold mt-0.5 px-1.5 py-0.5 rounded ${
                      isAlert ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                    }`}>
                    {Math.ceil(remaining)}s
                  </div>
                )}
              </div>
            </Marker>
          );
        })}

        {/* RENDER DIRECTIONAL ARROWS FOR GREEN SIGNALS */}
        {!loading && nodes.map(node => {
          // Use signal visualizer data if this is the selected node
          const signal = signalVisualizationData?.nodeId === node.node_id
            ? signalVisualizationData
            : signalStates?.[node.node_id];
          
          if (!signal?.current_green && !signal?.currentGreen) return null;

          const greenEdgeId = signal.currentGreen || signal.current_green;
          const greenEdge = edges.find(e => e.edge_id === greenEdgeId);
          if (!greenEdge) return null;

          const destNode = nodes.find(n => n.node_id === greenEdge.in_node_id);
          if (!destNode?.location?.lng || !destNode?.location?.lat) return null;
          if (!node?.location?.lng || !node?.location?.lat) return null;

          const t = 0.35;
          const arrowLng = node.location.lng + (destNode.location.lng - node.location.lng) * t;
          const arrowLat = node.location.lat + (destNode.location.lat - node.location.lat) * t;

          if (!isFinite(arrowLng) || !isFinite(arrowLat)) return null;

          const dx = destNode.location.lng - node.location.lng;
          const dy = destNode.location.lat - node.location.lat;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          return (
            <Marker
              key={`arrow-${greenEdge.edge_id}`}
              longitude={arrowLng}
              latitude={arrowLat}
              anchor="center"
            >
              <div
                style={{
                  transform: `rotate(${angle}deg)`,
                  filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))'
                }}
                className="text-yellow-300 text-3xl font-bold"
              >
                ▶
              </div>
            </Marker>
          );
        })}

        {/* EDGE LAYERS */}
        {!loading && mapLoaded && (
          <Source id="edges" type="geojson" data={edgeGeoJSON}>
            {/* Base Edge Layer */}
            <Layer
              id="edge-layer"
              type="line"
              paint={{
                'line-color': [
                  'case',
                  ['boolean', ['feature-state', 'isGreen'], false],
                  '#22c55e',
                  ['boolean', ['feature-state', 'isRoutingActive'], false],
                  '#f97316',
                  ['boolean', ['feature-state', 'isHovered'], false],
                  '#3b82f6',
                  '#64748b'
                ],
                'line-width': [
                  'case',
                  ['boolean', ['feature-state', 'isGreen'], false],
                  8,
                  ['boolean', ['feature-state', 'isRoutingActive'], false],
                  6,
                  4
                ],
                'line-opacity': 0.95
              }}
            />

            {/* Green Signal Pulse */}
            <Layer
              id="edge-green-pulse"
              type="line"
              filter={['==', ['feature-state', 'isGreen'], true]}
              paint={{
                'line-color': '#22c55e',
                'line-width': 12,
                'line-opacity': [
                  'interpolate',
                  ['linear'],
                  ['%', ['time'], 2000],
                  0, 0.2,
                  1000, 0.8,
                  2000, 0.2
                ]
              }}
            />

            {/* Routing Pulse */}
            <Layer
              id="edge-routing-pulse"
              type="line"
              filter={['==', ['feature-state', 'isRoutingActive'], true]}
              paint={{
                'line-color': '#f97316',
                'line-width': 10,
                'line-opacity': [
                  'interpolate',
                  ['linear'],
                  ['%', ['time'], 2000],
                  0, 0.15,
                  1000, 0.7,
                  2000, 0.15
                ]
              }}
            />
          </Source>
        )}

        {/* ROUTING PROBABILITY LABELS */}
        {!loading && mapLoaded && routingVisualizationData && routingLabelsGeoJSON.features.length > 0 && (
          <Source id="routing-labels" type="geojson" data={routingLabelsGeoJSON}>
            {/* Background Circles */}
            <Layer
              id="routing-labels-bg"
              type="circle"
              paint={{
                'circle-radius': 16,
                'circle-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'probability'],
                  0, '#6b7280',
                  0.33, '#eab308',
                  0.66, '#84cc16',
                  1.0, '#22c55e'
                ],
                'circle-opacity': 0.9,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2
              }}
            />

            {/* Probability Text */}
            <Layer
              id="routing-labels-text"
              type="symbol"
              layout={{
                'text-field': ['get', 'label'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 12,
                'text-anchor': 'center',
                'text-allow-overlap': true
              }}
              paint={{
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 1.5
              }}
            />
          </Source>
        )}
      </Map>
      
      {/* Edge Select Mode Indicator */}
      {selectEdgeMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600/90 text-white px-4 py-2 rounded-lg shadow-lg z-40 text-sm font-medium">
          🛣️ Click 2 nodes to create an edge
        </div>
      )}
    </div>
  );
}