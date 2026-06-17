export type SignalState = 'green' | 'red';
export type TrafficLevel = 'free' | 'light' | 'moderate' | 'heavy' | 'critical';
export type VisualizationMode = 'network' | 'routing' | 'traffic' | 'signal' | 'admin';

export interface Node {
  id: string;
  label: string;
  position: { x: number; y: number };
  type: 'intersection' | 'endpoint';
  currentGreenEdge?: string;
  cyclePosition?: number;
  lastUpdate?: string;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
  vehicleCount: number;
  queueLengthM: number;
  density: number;
  pressure: number;
  signalState: SignalState;
  greenTimeRemaining?: number;
  lastUpdate?: string;
}

export interface RoutingEntry {
  destination: string;
  nextHops: Array<{
    via: string;
    probability: number;
  }>;
}

export interface RoutingTable {
  nodeId: string;
  entries: RoutingEntry[];
  lastComputed?: string;
}

export interface TrafficSnapshot {
  timestamp: string;
  edges: Array<{
    edgeId: string;
    vehicleCount: number;
    queueLengthM: number;
    density: number;
    pressure: number;
  }>;
}

export interface SignalStateResponse {
  nodeId: string;
  currentGreen: string;
  cyclePosition: number;
  approaches: Array<{
    edgeId: string;
    state: SignalState;
    timeRemaining?: number;
  }>;
  timestamp: string;
}

export interface NetworkStats {
  totalNodes: number;
  totalEdges: number;
  avgQueueLength: number;
  avgPressure: number;
  criticalNodes: string[];
  networkHealth: number;
}

export interface AdminAction {
  type: 'recompute_green' | 'recompute_routing' | 'run_dv_update';
  nodeId?: string;
  timestamp: string;
  result?: 'success' | 'error';
  message?: string;
}

export interface WSMessage {
  type: 'traffic_update' | 'signal_update' | 'routing_update' | 'node_added' | 'edge_added';
  data: any;
  timestamp: string;
}