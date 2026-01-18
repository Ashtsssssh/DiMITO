import { useState, useCallback, useEffect } from 'react';
import Map, { NavigationControl, Marker, Popup } from "react-map-gl";
import { MapPin, Edit, Trash2 } from 'lucide-react';
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapView({ 
  clickEnabled, 
  onMapClick, 
  markerPosition,
  onNodeSelect,
  selectMode,
  selectedNodeForEdit,
  refetchTrigger,
  edgeSelectMode,
  selectedEdgeNodes,
  onEdgeNodeSelect
}) {
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNodes();
  }, [refetchTrigger]);

  const fetchNodes = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/node/get_all');
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched nodes:', data); // Debug log
        setNodes(data);
      } else {
        console.error('Failed to fetch nodes, status:', response.status);
      }
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = useCallback((event) => {
    if (clickEnabled && onMapClick) {
      const { lng, lat } = event.lngLat;
      console.log('Map clicked:', { lng, lat }); // Debug log
      onMapClick({ lng, lat });
    }
  }, [clickEnabled, onMapClick]);

  const handleNodeClick = (node, e) => {
    e.originalEvent.stopPropagation();
    
    if (edgeSelectMode && onEdgeNodeSelect) {
      onEdgeNodeSelect(node);
    } else if (selectMode && onNodeSelect) {
      setSelectedNodeId(node.node_id);
      onNodeSelect(node);
    } else {
      setHoveredNode(node);
    }
  };

  return (
    <div className="absolute inset-0 p-5">
      <div className={`w-full h-full rounded-lg overflow-hidden border ${
        clickEnabled ? 'border-violet-500 shadow-lg shadow-violet-500/50' : 
        selectMode ? 'border-yellow-500 shadow-lg shadow-yellow-500/50' : 
        edgeSelectMode ? 'border-cyan-500 shadow-lg shadow-cyan-500/50' :
        'border-gray-700'
      }`}>
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{
            latitude: 28.6139,
            longitude: 77.209,
            zoom: 12,
          }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ width: "100%", height: "100%" }}
          onClick={handleMapClick}
          cursor={clickEnabled ? 'crosshair' : (selectMode || edgeSelectMode) ? 'pointer' : 'grab'}
        >
          <NavigationControl position="bottom-right" />
          
          {/* Render existing nodes */}
          {!loading && nodes.length > 0 && nodes.map((node) => {
            if (!node.location?.lat || !node.location?.lng) {
              console.warn('Node missing location:', node);
              return null;
            }

            const isSelected = selectedNodeId === node.node_id;
            const isBeingEdited = selectedNodeForEdit?.node_id === node.node_id;
            const isEdgeNode = selectedEdgeNodes?.some(n => n.node_id === node.node_id);
            
            return (
              <Marker
                key={node.node_id}
                longitude={node.location.lng}
                latitude={node.location.lat}
                anchor="bottom"
                onClick={(e) => handleNodeClick(node, e)}
              >
                <div className="relative cursor-pointer group">
                  {isEdgeNode ? (
                    <div className="relative">
                      <MapPin className="w-8 h-8 text-cyan-400 fill-cyan-400 drop-shadow-lg animate-pulse" />
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-cyan-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        Node {selectedEdgeNodes.findIndex(n => n.node_id === node.node_id) + 1}
                      </div>
                    </div>
                  ) : selectMode === 'edit' && isSelected ? (
                    <div className="relative">
                      <MapPin className="w-8 h-8 text-yellow-400 fill-yellow-400 drop-shadow-lg animate-pulse" />
                      <Edit className="w-4 h-4 text-white absolute top-1 left-1/2 -translate-x-1/2" />
                    </div>
                  ) : selectMode === 'delete' && isSelected ? (
                    <div className="relative">
                      <MapPin className="w-8 h-8 text-red-500 fill-red-500 drop-shadow-lg animate-pulse" />
                      <Trash2 className="w-4 h-4 text-white absolute top-1 left-1/2 -translate-x-1/2" />
                    </div>
                  ) : isBeingEdited ? (
                    <div className="relative">
                      <MapPin className="w-7 h-7 text-orange-400 fill-orange-400 drop-shadow-lg opacity-50" />
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        Original
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <MapPin className={`w-6 h-6 transition-all ${
                        selectMode || edgeSelectMode ? 'text-blue-400 fill-blue-400 group-hover:w-8 group-hover:h-8' : 
                        'text-purple-400 fill-purple-400'
                      } drop-shadow-lg`} />
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        {node.name}
                      </div>
                    </div>
                  )}
                </div>
              </Marker>
            );
          })}
          
          {/* New marker when adding/editing */}
          {markerPosition && (
            <Marker
              longitude={markerPosition.lng}
              latitude={markerPosition.lat}
              anchor="bottom"
            >
              <div className="relative">
                <MapPin className="w-10 h-10 text-violet-500 fill-violet-500 drop-shadow-lg animate-bounce" />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {selectedNodeForEdit ? 'New Position' : 'New Location'}
                </div>
              </div>
            </Marker>
          )}

          {/* Popup for hovered node */}
          {hoveredNode && !selectMode && !edgeSelectMode && (
            <Popup
              longitude={hoveredNode.location?.lng || 0}
              latitude={hoveredNode.location?.lat || 0}
              anchor="top"
              onClose={() => setHoveredNode(null)}
              closeButton={true}
              closeOnClick={false}
            >
              <div className="p-2">
                <h3 className="font-bold text-sm">{hoveredNode.name}</h3>
                <p className="text-xs text-gray-600">ID: {hoveredNode.node_id}</p>
                <p className="text-xs text-gray-600">
                  Lat: {hoveredNode.location?.lat?.toFixed(4)}, 
                  Lng: {hoveredNode.location?.lng?.toFixed(4)}
                </p>
                <p className={`text-xs mt-1 ${hoveredNode.is_active ? 'text-green-600' : 'text-red-600'}`}>
                  {hoveredNode.is_active ? '● Active' : '○ Inactive'}
                </p>
              </div>
            </Popup>
          )}
        </Map>
        
        {/* Loading indicator */}
        {loading && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900/90 text-white px-6 py-3 rounded-lg">
            Loading nodes...
          </div>
        )}

        {/* No nodes indicator */}
        {!loading && nodes.length === 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900/90 text-white px-6 py-3 rounded-lg text-center">
            <p className="font-medium">No nodes yet</p>
            <p className="text-sm text-gray-400 mt-1">Click "Add Node" to create one</p>
          </div>
        )}
        
        {/* Instruction overlays */}
        {clickEnabled && !selectedNodeForEdit && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-violet-600 text-white px-6 py-3 rounded-lg shadow-lg font-medium z-10">
            📍 Click on the map to set location
          </div>
        )}
        
        {clickEnabled && selectedNodeForEdit && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-violet-600 text-white px-6 py-3 rounded-lg shadow-lg font-medium z-10 animate-pulse">
            📍 Click on the map to set NEW location
          </div>
        )}
        
        {selectMode === 'edit' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-600 text-white px-6 py-3 rounded-lg shadow-lg font-medium z-10">
            ✏️ Click on a node to select it for editing
          </div>
        )}
        
        {selectMode === 'delete' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg font-medium z-10">
            🗑️ Click on a node to select it for deletion
          </div>
        )}

        {edgeSelectMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-cyan-600 text-white px-6 py-3 rounded-lg shadow-lg font-medium z-10">
            🛣️ Select 2 nodes to connect ({selectedEdgeNodes?.length || 0}/2)
          </div>
        )}
      </div>
    </div>
  );
}