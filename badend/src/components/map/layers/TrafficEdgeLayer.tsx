import { Source, Layer } from 'react-map-gl';
import { Edge, VisualizationMode } from '@/types/network';
import { useNetworkStore } from '@/stores/networkStore';

interface TrafficEdgeLayerProps {
  edges: Edge[];
  mode: VisualizationMode;
}

export default function TrafficEdgeLayer({ edges, mode }: TrafficEdgeLayerProps) {
  const { nodes } = useNetworkStore();

  // Convert edges to GeoJSON
  const geojson = {
    type: 'FeatureCollection' as const,
    features: edges.map((edge) => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) return null;

      return {
        type: 'Feature' as const,
        properties: {
          id: edge.id,
          signalState: edge.signalState,
          queueLength: edge.queueLengthM,
          pressure: edge.pressure,
          density: edge.density,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [sourceNode.position.x, sourceNode.position.y],
            [targetNode.position.x, targetNode.position.y],
          ],
        },
      };
    }).filter(Boolean),
  };

  // Determine line color based on mode
  const getLineColor = (): any => {
    switch (mode) {
      case 'signal':
        // Green/red based on signal state
        return [
          'match',
          ['get', 'signalState'],
          'green', '#10b981',
          'red', '#ef4444',
          '#6b7280'
        ];
      
      case 'traffic':
        // Color based on queue length
        return [
          'interpolate',
          ['linear'],
          ['get', 'queueLength'],
          0, '#22c55e',     // free
          10, '#84cc16',    // light
          30, '#eab308',    // moderate
          60, '#f97316',    // heavy
          100, '#dc2626'    // critical
        ];
      
      case 'routing':
        return '#6b7280';
      
      default:
        return '#6b7280';
    }
  };

  // Determine line width based on mode
  const getLineWidth = (): any => {
    if (mode === 'traffic') {
      // Width based on queue length
      return [
        'interpolate',
        ['linear'],
        ['get', 'queueLength'],
        0, 3,
        50, 6,
        100, 10
      ];
    }
    return 4;
  };

  return (
    <Source id="traffic-edges" type="geojson" data={geojson as any}>
      {/* Edge base layer */}
      <Layer
        id="edge-base"
        type="line"
        paint={{
          'line-color': getLineColor(),
          'line-width': getLineWidth(),
          'line-opacity': 0.8,
        }}
      />

      {/* Edge outline for better visibility */}
      <Layer
        id="edge-outline"
        type="line"
        paint={{
          'line-color': '#000000',
          'line-width': ['+', getLineWidth(), 2],
          'line-opacity': 0.3,
        }}
      />

      {/* Animated flow for green signals */}
      {mode === 'signal' && (
        <Layer
          id="edge-flow"
          type="line"
          paint={{
            'line-color': '#10b981',
            'line-width': 2,
            'line-opacity': [
              'match',
              ['get', 'signalState'],
              'green', 0.6,
              0
            ],
            'line-dasharray': [0, 2, 2],
          }}
        />
      )}
    </Source>
  );
}