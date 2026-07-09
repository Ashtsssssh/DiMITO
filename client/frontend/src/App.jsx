import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import AddPage from './pages/AddPage';
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
  // NOTE: this used to be `useRef(null)`. Mutating a ref's `.current` does
  // NOT trigger a re-render, so MapView kept receiving a stale (null)
  // handler prop right after the modal opened — the very first node click
  // was silently swallowed because MapView's click-priority chain saw a
  // falsy `routingNodeClickHandler`. Using state means registering the
  // handler actually re-renders App and MapView gets the live handler.
  const [routingNodeClickHandler, setRoutingNodeClickHandler] = useState(null);

  // ✅ NEW: SIGNAL SCHEDULE VISUALIZER STATE
  const [showSignalModal, setShowSignalModal] = useState(false);
  const [signalVisualizationData, setSignalVisualizationData] = useState(null);
  const [signalNodeClickHandler, setSignalNodeClickHandler] = useState(null);

  // Stable callbacks (useCallback) so RoutingVisualizer/SignalScheduleVisualizer's
  // registration effects don't re-fire on every unrelated App re-render.
  const handleRoutingModalClose = useCallback(() => {
    console.log('[App] Closing routing modal');
    setShowRoutingModal(false);
    setRoutingVisualizationData(null);
    setRoutingNodeClickHandler(null);
  }, []);

  const handleRoutingNodeClickHandler = useCallback((handler) => {
    console.log('[App] Routing handler registered:', !!handler);
    // Wrap in an arrow function: setState treats a bare function argument
    // as a functional updater, so passing the handler directly would make
    // React call it instead of storing it.
    setRoutingNodeClickHandler(() => handler);
  }, []);

  const handleSignalModalClose = useCallback(() => {
    console.log('[App] Closing signal modal');
    setShowSignalModal(false);
    setSignalVisualizationData(null);
    setSignalNodeClickHandler(null);
  }, []);

  const handleSignalNodeClickHandler = useCallback((handler) => {
    console.log('[App] Signal handler registered:', !!handler);
    setSignalNodeClickHandler(() => handler);
  }, []);

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

          // signalStates: Page2 removed — global overlay disabled; SignalScheduleVisualizer handles per-node signal view
          signalStates={{}}
          routingVisualizationData={routingVisualizationData}
          routingNodeClickHandler={routingNodeClickHandler}
          
          // ✅ NEW: Signal visualization props
          signalNodeClickHandler={signalNodeClickHandler}
          signalVisualizationData={signalVisualizationData}
        />

        {/* Routing Visualizer */}
        <RoutingVisualizer
          nodes={allNodes}
          edges={allEdges}
          showModal={showRoutingModal}
          onModalClose={handleRoutingModalClose}
          onNodeClickHandler={handleRoutingNodeClickHandler}
          onVisualizationUpdate={setRoutingVisualizationData}
        />

        {/* ✅ NEW: Signal Schedule Visualizer */}
        <SignalScheduleVisualizer
          nodes={allNodes}
          edges={allEdges}
          showModal={showSignalModal}
          onModalClose={handleSignalModalClose}
          onNodeClickHandler={handleSignalNodeClickHandler}
          onSignalVisualizationUpdate={setSignalVisualizationData}
        />

        <Routes>
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