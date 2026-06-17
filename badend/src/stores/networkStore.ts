import { create } from 'zustand';
import { Node, Edge, RoutingTable, VisualizationMode, NetworkStats } from '@/types/network';

interface NetworkStore {
  mode: VisualizationMode;
  setMode: (mode: VisualizationMode) => void;
  nodes: Node[];
  edges: Edge[];
  routingTables: Map<string, RoutingTable>;
  selectedNodeId: string | null;
  selectedDestinationId: string | null;
  hoveredNodeId: string | null;
  stats: NetworkStats | null;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  updateEdge: (edgeId: string, updates: Partial<Edge>) => void;
  setRoutingTable: (nodeId: string, table: RoutingTable) => void;
  selectNode: (nodeId: string | null) => void;
  selectDestination: (nodeId: string | null) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setStats: (stats: NetworkStats) => void;
  batchUpdateEdges: (updates: Array<{ edgeId: string; updates: Partial<Edge> }>) => void;
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  mode: 'network',
  nodes: [],
  edges: [],
  routingTables: new Map(),
  selectedNodeId: null,
  selectedDestinationId: null,
  hoveredNodeId: null,
  stats: null,
  setMode: (mode) => set({ mode }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  updateNode: (nodeId, updates) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, ...updates } : node
      ),
    })),
  updateEdge: (edgeId, updates) =>
    set((state) => ({
      edges: state.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, ...updates } : edge
      ),
    })),
  setRoutingTable: (nodeId, table) =>
    set((state) => ({
      routingTables: new Map(state.routingTables).set(nodeId, table),
    })),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  selectDestination: (nodeId) => set({ selectedDestinationId: nodeId }),
  setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
  setStats: (stats) => set({ stats }),
  batchUpdateEdges: (updates) =>
    set((state) => {
      const edgeMap = new Map(state.edges.map((e) => [e.id, e]));
      updates.forEach(({ edgeId, updates }) => {
        const edge = edgeMap.get(edgeId);
        if (edge) {
          edgeMap.set(edgeId, { ...edge, ...updates });
        }
      });
      return { edges: Array.from(edgeMap.values()) };
    }),
}));