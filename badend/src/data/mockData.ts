import { useNetworkStore } from '@/stores/networkStore';
import { Node, Edge } from '@/types/network';

// Mock data for Vadodara intersections (you can replace with real coordinates)
export function loadMockData() {
  const mockNodes: Node[] = [
    {
      id: 'N1',
      label: 'Alkapuri',
      position: { x: 73.1812, y: 22.3072 },
      type: 'intersection',
      currentGreenEdge: 'E1',
      cyclePosition: 45,
    },
    {
      id: 'N2',
      label: 'Akota',
      position: { x: 73.1950, y: 22.2950 },
      type: 'intersection',
      currentGreenEdge: 'E3',
      cyclePosition: 70,
    },
    {
      id: 'N3',
      label: 'Gotri',
      position: { x: 73.1600, y: 22.2850 },
      type: 'intersection',
      cyclePosition: 30,
    },
    {
      id: 'N4',
      label: 'Manjalpur',
      position: { x: 73.1750, y: 22.3150 },
      type: 'intersection',
      currentGreenEdge: 'E7',
      cyclePosition: 60,
    },
  ];

  const mockEdges: Edge[] = [
    {
      id: 'E1',
      source: 'N1',
      target: 'N2',
      vehicleCount: 45,
      queueLengthM: 25.5,
      density: 0.65,
      pressure: 0.72,
      signalState: 'green',
      greenTimeRemaining: 15,
    },
    {
      id: 'E2',
      source: 'N2',
      target: 'N1',
      vehicleCount: 32,
      queueLengthM: 18.2,
      density: 0.45,
      pressure: 0.55,
      signalState: 'red',
    },
    {
      id: 'E3',
      source: 'N2',
      target: 'N3',
      vehicleCount: 58,
      queueLengthM: 42.8,
      density: 0.78,
      pressure: 0.85,
      signalState: 'green',
      greenTimeRemaining: 22,
    },
    {
      id: 'E4',
      source: 'N3',
      target: 'N2',
      vehicleCount: 28,
      queueLengthM: 12.5,
      density: 0.35,
      pressure: 0.42,
      signalState: 'red',
    },
    {
      id: 'E5',
      source: 'N1',
      target: 'N4',
      vehicleCount: 67,
      queueLengthM: 55.3,
      density: 0.88,
      pressure: 0.92,
      signalState: 'red',
    },
    {
      id: 'E6',
      source: 'N4',
      target: 'N1',
      vehicleCount: 41,
      queueLengthM: 28.7,
      density: 0.58,
      pressure: 0.65,
      signalState: 'red',
    },
    {
      id: 'E7',
      source: 'N4',
      target: 'N3',
      vehicleCount: 35,
      queueLengthM: 22.1,
      density: 0.52,
      pressure: 0.60,
      signalState: 'green',
      greenTimeRemaining: 18,
    },
    {
      id: 'E8',
      source: 'N3',
      target: 'N4',
      vehicleCount: 29,
      queueLengthM: 15.9,
      density: 0.42,
      pressure: 0.48,
      signalState: 'red',
    },
  ];

  // Set mock routing table
  const mockRoutingTable = {
    nodeId: 'N1',
    entries: [
      {
        destination: 'N3',
        nextHops: [
          { via: 'N2', probability: 0.72 },
          { via: 'N4', probability: 0.28 },
        ],
      },
      {
        destination: 'N4',
        nextHops: [
          { via: 'N4', probability: 1.0 },
        ],
      },
    ],
  };

  // Update store
  const store = useNetworkStore.getState();
  store.setNodes(mockNodes);
  store.setEdges(mockEdges);
  store.setRoutingTable('N1', mockRoutingTable);
}