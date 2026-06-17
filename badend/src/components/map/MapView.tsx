import { useState, useCallback } from 'react';
import Map, { Marker, Layer, Source, NavigationControl } from 'react-map-gl';
import { useNetworkStore } from '@/stores/networkStore';
import IntersectionMarker from './markers/IntersectionMarker';
import TrafficEdgeLayer from './layers/TrafficEdgeLayer';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Default to Vadodara, Gujarat center (you can change this)
const DEFAULT_CENTER = {
  longitude: 73.1812,
  latitude: 22.3072,
  zoom: 12
};

export default function MapView() {
  const { nodes, edges, mode, selectNode } = useNetworkStore();
  
  const [viewState, setViewState] = useState(DEFAULT_CENTER);

  const handleNodeClick = useCallback((nodeId: string) => {
    selectNode(nodeId);
  }, [selectNode]);

  return (
    <div className="w-full h-full relative">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        attributionControl={false}
      >
        {/* Navigation controls */}
        <NavigationControl position="top-right" />

        {/* Traffic edges (roads) */}
        <TrafficEdgeLayer edges={edges} mode={mode} />

        {/* Intersection markers (nodes) */}
        {nodes.map((node) => (
          <Marker
            key={node.id}
            longitude={node.position.x}
            latitude={node.position.y}
            anchor="center"
          >
            <IntersectionMarker
              node={node}
              onClick={() => handleNodeClick(node.id)}
            />
          </Marker>
        ))}
      </Map>

      {/* Map overlay info */}
      <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl">
        <div className="text-xs font-mono text-muted-foreground">
          Mode: <span className="text-foreground font-semibold capitalize">{mode}</span>
        </div>
        <div className="text-xs font-mono text-muted-foreground mt-1">
          Nodes: <span className="text-foreground">{nodes.length}</span> | 
          Edges: <span className="text-foreground ml-1">{edges.length}</span>
        </div>
      </div>
    </div>
  );
}