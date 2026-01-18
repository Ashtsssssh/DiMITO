import { useState } from 'react';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import AddPage from './pages/AddPage';
import Page2 from './pages/Page2';
import Page3 from './pages/Page3';
import Page4 from './pages/Page4';

export default function App() {
  const [currentPath, setCurrentPath] = useState('/');
  const [mapClickEnabled, setMapClickEnabled] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [selectMode, setSelectMode] = useState(null);
  const [selectedNodeForEdit, setSelectedNodeForEdit] = useState(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [edgeSelectMode, setEdgeSelectMode] = useState(false);
  const [selectedEdgeNodes, setSelectedEdgeNodes] = useState([]);

  const handleNavigate = (path) => {
    setCurrentPath(path);
    if (path !== '/add') {
      resetAllStates();
    }
  };

  const resetAllStates = () => {
    setMapClickEnabled(false);
    setSelectedCoordinates(null);
    setSelectMode(null);
    setSelectedNodeForEdit(null);
    setEdgeSelectMode(false);
    setSelectedEdgeNodes([]);
  };

  const enableMapClick = () => {
    setMapClickEnabled(true);
    setSelectedCoordinates(null);
    setSelectMode(null);
    setEdgeSelectMode(false);
  };

  const enableNodeSelect = (mode) => {
    setSelectMode(mode);
    setMapClickEnabled(false);
    setSelectedNodeForEdit(null);
    setEdgeSelectMode(false);
  };

  const enableEdgeNodeSelect = () => {
    setEdgeSelectMode(true);
    setSelectedEdgeNodes([]);
    setSelectMode(null);
    setMapClickEnabled(false);
  };

  const handleMapClick = (coords) => {
    setSelectedCoordinates(coords);
    setMapClickEnabled(false);
  };

  const handleNodeSelect = (node) => {
    setSelectedNodeForEdit(node);
    setSelectMode(null);
    
    if (node) {
      setMapClickEnabled(true);
    }
  };

  const handleEdgeNodeSelect = (node) => {
    setSelectedEdgeNodes(prev => {
      if (prev.length >= 2) {
        return [node];
      }
      return [...prev, node];
    });
  };

  const clearCoordinates = () => {
    resetAllStates();
  };

  const handleNodesUpdate = () => {
    setRefetchTrigger(prev => prev + 1);
  };

  return (
    <div className="h-screen w-screen bg-zinc-950 flex flex-col overflow-hidden">
      <Navbar currentPath={currentPath} onNavigate={handleNavigate} />
      
      <div className="flex-1 relative overflow-hidden">
        <MapView 
          clickEnabled={mapClickEnabled}
          onMapClick={handleMapClick}
          markerPosition={selectedCoordinates}
          selectMode={selectMode}
          onNodeSelect={handleNodeSelect}
          selectedNodeForEdit={selectedNodeForEdit}
          refetchTrigger={refetchTrigger}
          edgeSelectMode={edgeSelectMode}
          selectedEdgeNodes={selectedEdgeNodes}
          onEdgeNodeSelect={handleEdgeNodeSelect}
        />

        {currentPath === '/add' && (
          <AddPage 
            onMapClick={enableMapClick}
            onNodeSelect={enableNodeSelect}
            selectedCoordinates={selectedCoordinates}
            selectedNode={selectedNodeForEdit}
            clearCoordinates={clearCoordinates}
            onNodesUpdate={handleNodesUpdate}
            onEdgeNodeSelect={enableEdgeNodeSelect}
            selectedEdgeNodes={selectedEdgeNodes}
          />
        )}
        {currentPath === '/page2' && <Page2 />}
        {currentPath === '/page3' && <Page3 />}
        {currentPath === '/page4' && <Page4 />}
      </div>
    </div>
  );
}