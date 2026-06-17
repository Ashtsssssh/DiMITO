import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import AddPage from './pages/AddPage';
import Page2 from './pages/Page2';
import Page3 from './pages/Page3';
import Page4 from './pages/Page4';
import RoutingVisualizer from './features/RoutingVisualizer';

export default function App() {
  const location = useLocation();

  const [mapClickEnabled, setMapClickEnabled] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [selectMode, setSelectMode] = useState(null);
  const [selectedNodeForEdit, setSelectedNodeForEdit] = useState(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const [edgeSelectMode, setEdgeSelectMode] = useState(false);
  const [selectedEdgeNodes, setSelectedEdgeNodes] = useState([]);
  const [selectEdgeMode, setSelectEdgeMode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);

  const [routingStartNode, setRoutingStartNode] = useState(null);
  const [routingDestNode, setRoutingDestNode] = useState(null);

  const [allNodes, setAllNodes] = useState([]);
  const [allEdges, setAllEdges] = useState([]);
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [routingVisualizationData, setRoutingVisualizationData] = useState(null);

  // 🚦 GLOBAL SIGNAL STATE (FOR MAP)
  const [signalStates, setSignalStates] = useState({});

  // 🛣️ ROUTING HANDLER REF (stores the click handler from RoutingVisualizer)
  const routingNodeClickHandlerRef = useRef(null);

  const resetAllStates = () => {
    setMapClickEnabled(false);
    setSelectedCoordinates(null);
    setSelectMode(null);
    setSelectedNodeForEdit(null);
    setEdgeSelectMode(false);
    setSelectedEdgeNodes([]);
    setSelectEdgeMode(null);
    setSelectedEdge(null);
    setRoutingStartNode(null);
    setRoutingDestNode(null);
  };

  // Debug logging for handler and modal state
  useEffect(() => {
    console.log('[App] showRoutingModal changed to:', showRoutingModal);
  }, [showRoutingModal]);

  useEffect(() => {
    console.log('[App] routingNodeClickHandlerRef.current updated:', !!routingNodeClickHandlerRef.current);
  }, [routingNodeClickHandlerRef.current]);

  return (
    <div className="h-screen w-screen bg-zinc-950 flex flex-col overflow-hidden">
      <Navbar
        currentPath={location.pathname}
        onOpenRoutingModal={() => setShowRoutingModal(true)}
      />

      <div className="flex-1 relative overflow-hidden">
        <MapView
          clickEnabled={mapClickEnabled}
          onMapClick={(c) => { setSelectedCoordinates(c); setMapClickEnabled(false); }}
          markerPosition={selectedCoordinates}
          selectMode={selectMode}
          onNodeSelect={(n) => {
            console.log('[App.onNodeSelect] Node clicked:', n?.name, 'Node ID:', n?.node_id);
            setSelectedNodeForEdit(n);
          }}
          selectedNodeForEdit={selectedNodeForEdit}
          refetchTrigger={refetchTrigger}

          selectedEdgeNodes={selectedEdgeNodes}
          onEdgeNodeSelect={(n) => {
            console.log('[App.onEdgeNodeSelect] Node clicked:', n);
            setSelectedEdgeNodes(p => {
              const updated = [...p, n];
              console.log('[App] Updated selectedEdgeNodes:', updated);
              return updated;
            });
            // Auto-disable edge select mode if 2 nodes selected
            if (selectedEdgeNodes.length >= 1) {
              console.log('[App] 2 nodes selected, disabling edge select mode');
              setSelectEdgeMode(false);
            }
          }}
          selectEdgeMode={selectEdgeMode}
          onEdgeSelect={setSelectedEdge}
          selectedEdge={selectedEdge}

          routingStartNode={routingStartNode}
          onRoutingStartNodeSelect={setRoutingStartNode}
          routingDestNode={routingDestNode}
          onRoutingDestNodeSelect={setRoutingDestNode}

          onNodesUpdate={setAllNodes}
          onEdgesUpdate={setAllEdges}

          signalStates={signalStates}
          routingVisualizationData={routingVisualizationData}
          routingNodeClickHandler={routingNodeClickHandlerRef.current}  // ✅ NEW: Pass the handler from ref
        />

        <RoutingVisualizer
          nodes={allNodes}
          edges={allEdges}
          showModal={showRoutingModal}
          onModalClose={() => {
            console.log('[App] Closing routing modal');
            setShowRoutingModal(false);
            setRoutingVisualizationData(null);
            routingNodeClickHandlerRef.current = null;  // ✅ Clear handler on close
          }}
          onNodeClickHandler={(handler) => {  // ✅ CHANGED: from onHandlerReady to onNodeClickHandler
            console.log('[App] Routing handler registered:', !!handler);
            routingNodeClickHandlerRef.current = handler;
          }}
          onVisualizationUpdate={setRoutingVisualizationData}
        />

        <Routes>
          <Route
            path="/page2"
            element={<Page2 onSignalUpdate={setSignalStates} />}
          />
          <Route 
            path="/add" 
            element={
              <AddPage 
                onMapClick={() => setMapClickEnabled(true)}
                onNodeSelect={setSelectMode}
                selectedCoordinates={selectedCoordinates}
                selectedNode={selectedNodeForEdit}
                clearCoordinates={() => setSelectedCoordinates(null)}
                onNodesUpdate={setAllNodes}
                selectedEdgeNodes={selectedEdgeNodes}
                onEdgeNodeSelect={() => {
                  console.log('[App/AddPage] Enabling edge select mode');
                  setSelectEdgeMode(true);
                }}
                selectEdgeMode={selectEdgeMode}
                selectedEdge={selectedEdge}
                onSelectEdgeMode={setSelectEdgeMode}
                clearEdgeNodes={() => setSelectedEdgeNodes([])}
              />
            }
          />
          <Route path="/page3" element={<Page3 />} />
          <Route path="/page4" element={<Page4 />} />
        </Routes>
      </div>
    </div>
  );
}