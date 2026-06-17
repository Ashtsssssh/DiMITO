import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import AddPage from './pages/AddPage';
import Page2 from './pages/Page2';
import Page3 from './pages/Page3';
import Page4 from './pages/Page4';
import RoutingVisualizer from './features/RoutingVisualizer';
import SignalScheduleVisualizer from './features/SignalScheduleVisualizer';  // ✅ NEW

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
  
  // 🛣️ ROUTING VISUALIZER STATE
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [routingVisualizationData, setRoutingVisualizationData] = useState(null);
  const routingNodeClickHandlerRef = useRef(null);

  // ✅ NEW: SIGNAL SCHEDULE VISUALIZER STATE
  const [showSignalModal, setShowSignalModal] = useState(false);
  const [signalVisualizationData, setSignalVisualizationData] = useState(null);
  const signalNodeClickHandlerRef = useRef(null);

  // 🚦 GLOBAL SIGNAL STATE (FOR MAP - from Page2)
  const [signalStates, setSignalStates] = useState({});

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

  // Debug logging
  useEffect(() => {
    console.log('[App] showRoutingModal:', showRoutingModal);
    console.log('[App] showSignalModal:', showSignalModal);
  }, [showRoutingModal, showSignalModal]);

  return (
    <div className="h-screen w-screen bg-zinc-950 flex flex-col overflow-hidden">
      <Navbar
        currentPath={location.pathname}
        onOpenRoutingModal={() => setShowRoutingModal(true)}
        onOpenSignalModal={() => setShowSignalModal(true)}  // ✅ NEW: Signal modal trigger
      />

      <div className="flex-1 relative overflow-hidden">
        <MapView
          clickEnabled={mapClickEnabled}
          onMapClick={(c) => { setSelectedCoordinates(c); setMapClickEnabled(false); }}
          markerPosition={selectedCoordinates}
          selectMode={selectMode}
          onNodeSelect={(n) => {
            console.log('[App.onNodeSelect] Node clicked:', n?.name);
            setSelectedNodeForEdit(n);
          }}
          selectedNodeForEdit={selectedNodeForEdit}
          refetchTrigger={refetchTrigger}

          selectedEdgeNodes={selectedEdgeNodes}
          onEdgeNodeSelect={(n) => {
            console.log('[App.onEdgeNodeSelect] Node clicked:', n);
            setSelectedEdgeNodes(p => {
              const updated = [...p, n];
              return updated;
            });
            if (selectedEdgeNodes.length >= 1) {
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
          routingNodeClickHandler={routingNodeClickHandlerRef.current}
          
          // ✅ NEW: Signal visualization props
          signalNodeClickHandler={signalNodeClickHandlerRef.current}
          signalVisualizationData={signalVisualizationData}
        />

        {/* Routing Visualizer */}
        <RoutingVisualizer
          nodes={allNodes}
          edges={allEdges}
          showModal={showRoutingModal}
          onModalClose={() => {
            console.log('[App] Closing routing modal');
            setShowRoutingModal(false);
            setRoutingVisualizationData(null);
            routingNodeClickHandlerRef.current = null;
          }}
          onNodeClickHandler={(handler) => {
            console.log('[App] Routing handler registered:', !!handler);
            routingNodeClickHandlerRef.current = handler;
          }}
          onVisualizationUpdate={setRoutingVisualizationData}
        />

        {/* ✅ NEW: Signal Schedule Visualizer */}
        <SignalScheduleVisualizer
          nodes={allNodes}
          edges={allEdges}
          showModal={showSignalModal}
          onModalClose={() => {
            console.log('[App] Closing signal modal');
            setShowSignalModal(false);
            setSignalVisualizationData(null);
            signalNodeClickHandlerRef.current = null;
          }}
          onNodeClickHandler={(handler) => {
            console.log('[App] Signal handler registered:', !!handler);
            signalNodeClickHandlerRef.current = handler;
          }}
          onSignalVisualizationUpdate={setSignalVisualizationData}
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