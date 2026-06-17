import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MapView from '@/components/map/MapView';
import ModeSelector from '@/components/controls/ModeSelector';
import SidePanel from '@/components/panels/SidePanel';
import StatsBar from '@/components/ui/StatsBar';
import { useEffect } from 'react';
import { wsService } from '@/services/websocket';
import { useNetworkStore } from '@/stores/networkStore';
import '@/styles/globals.css';
import 'mapbox-gl/dist/mapbox-gl.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const { batchUpdateEdges, updateNode } = useNetworkStore();

  useEffect(() => {
    // Connect WebSocket
    wsService.connect();

    // Subscribe to WebSocket messages
    const unsubscribe = wsService.subscribe((message) => {
      switch (message.type) {
        case 'traffic_update':
          // Batch update edge traffic data
          if (message.data.edges) {
            const updates = message.data.edges.map((edge: any) => ({
              edgeId: edge.edgeId,
              updates: {
                vehicleCount: edge.vehicleCount,
                queueLengthM: edge.queueLengthM,
                density: edge.density,
                pressure: edge.pressure,
                lastUpdate: edge.timestamp,
              },
            }));
            batchUpdateEdges(updates);
          }
          break;

        case 'signal_update':
          // Update node signal state
          if (message.data.nodeId) {
            updateNode(message.data.nodeId, {
              currentGreenEdge: message.data.currentGreen,
              cyclePosition: message.data.cyclePosition,
              lastUpdate: message.data.timestamp,
            });
          }
          break;

        case 'routing_update':
          console.log('Routing table updated:', message.data);
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    });

    return () => {
      unsubscribe();
      wsService.disconnect();
    };
  }, [batchUpdateEdges, updateNode]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between shadow-lg">
          <div>
            <h1 className="text-2xl font-bold text-foreground">DiMITO Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Distributed Multi-Intersection Traffic Optimization</p>
          </div>
          <ModeSelector />
        </header>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map View */}
          <div className="flex-1 relative">
            <MapView />
          </div>

          {/* Side Panel */}
          <SidePanel />
        </div>

        {/* Stats Bar */}
        <StatsBar />
      </div>
    </QueryClientProvider>
  );
}

export default App;