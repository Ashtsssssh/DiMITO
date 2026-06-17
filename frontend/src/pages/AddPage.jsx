import { useState, useEffect } from 'react';
import Dropdown from '@/components/ui/Dropdown';
import FormRenderer from '@/components/ui/FormRenderer';
import { nodeAPI, edgeAPI, cameraAPI, calculateDistance } from '@/api/api';

export default function AddPage({ 
  onMapClick, 
  onNodeSelect, 
  selectedCoordinates, 
  selectedNode, 
  clearCoordinates, 
  onNodesUpdate,
  selectedEdgeNodes,
  onEdgeNodeSelect,
  selectEdgeMode,
  selectedEdge,
  onSelectEdgeMode,
  clearEdgeNodes
}) {
  const [activeForm, setActiveForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [trafficMsg, setTrafficMsg] = useState(null);

  useEffect(() => {
    fetchNodes();
    fetchEdges();
  }, []);

  useEffect(() => {
    if (selectedNode) {
      fetchNodes();
    }
  }, [selectedNode]);

  useEffect(() => {
    console.log('[AddPage] selectEdgeMode changed:', selectEdgeMode);
    console.log('[AddPage] selectedEdgeNodes:', selectedEdgeNodes);
  }, [selectEdgeMode, selectedEdgeNodes]);

  const fetchNodes = async () => {
    try {
      const data = await nodeAPI.getAll();
      setNodes(data);
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    }
  };

  const fetchEdges = async () => {
    try {
      const data = await edgeAPI.getAll();
      setEdges(data);
    } catch (err) {
      console.error('Failed to fetch edges:', err);
    }
  };

  // Find edge between two selected nodes (bidirectional)
  function findEdgeBetweenNodes(nodeA, nodeB) {
    if (!nodeA || !nodeB) return null;
    return edges.find(
      (e) =>
        (e.in_node_id === nodeA.node_id && e.out_node_id === nodeB.node_id) ||
        (e.in_node_id === nodeB.node_id && e.out_node_id === nodeA.node_id)
    );
  }

  const handleFormSubmit = async (data) => {
    setLoading(true);
    setError(null);

    try {
      let result;
      if (activeForm.apiType === 'node/add') {
        result = await nodeAPI.add({
          node_id: `node_${Date.now()}`,
          name: data.name,
          location: {
            lat: data.latitude,
            lng: data.longitude,
          },
          is_active: true
        });
      } 
      else if (activeForm.apiType === 'node/edit') {
        result = await nodeAPI.edit({
          node_id: selectedNode?.node_id,
          name: data.name,
          location: {
            lat: data.latitude,
            lng: data.longitude,
          },
          is_active: data.is_active === 'true'
        });
      } 
      else if (activeForm.apiType === 'node/del') {
        result = await nodeAPI.delete(selectedNode?.node_id, data.reason);
      }
      else if (activeForm.apiType === 'edge/add') {
        const node1 = selectedEdgeNodes[0];
        const node2 = selectedEdgeNodes[1];
        
        const distance = calculateDistance(
          node1.location.lat, node1.location.lng,
          node2.location.lat, node2.location.lng
        );

        const roadWidth = parseFloat(data.lanes) * 3.5;

        result = await edgeAPI.addBidirectional(
          node1.node_id,
          node2.node_id,
          {
            name: data.name,
            camera_id: data.camera_id || '',
            road_length_m: distance,
            road_width_m: roadWidth,
          }
        );

        console.log('Created edges:', result);
      }
      else if (activeForm.apiType === 'edge/edit') {
        // Use two selected nodes to find the edge
        const node1 = selectedEdgeNodes[0];
        const node2 = selectedEdgeNodes[1];
        const edge = findEdgeBetweenNodes(node1, node2);
        if (!edge) throw new Error('No edge exists between selected nodes');
        
        // Calculate road width from lanes
        const roadWidth = parseFloat(data.lanes) * 3.5;
        
        result = await edgeAPI.edit({
          edge_id: edge.edge_id,
          name: data.name,
          in_node_id: edge.in_node_id,
          out_node_id: edge.out_node_id,
          camera_id: data.camera_id || edge.camera_id,
          road_length_m: edge.road_length_m,
          road_width_m: roadWidth,
          is_active: data.is_active === 'true',
        });
      }
      else if (activeForm.apiType === 'edge/del') {
        // Use two selected nodes to find the edge
        const node1 = selectedEdgeNodes[0];
        const node2 = selectedEdgeNodes[1];
        const edge = findEdgeBetweenNodes(node1, node2);
        if (!edge) throw new Error('No edge exists between selected nodes');
        
        // Delete both directional edges
        const edge_forward = `e_${edge.in_node_id}_${edge.out_node_id}`;
        const edge_reverse = `e_${edge.out_node_id}_${edge.in_node_id}`;
        
        await edgeAPI.delete(edge_forward);
        await edgeAPI.delete(edge_reverse);
        result = { message: 'Both edges deleted successfully' };
      }
      else if (activeForm.apiType === 'camera/add') {
        result = await cameraAPI.add({
          camera_id: data.cameraId,
          edge_id: data.edgeId,
          position: data.position,
          type: data.cameraType || 'traffic',
          settings: {
            speed_threshold: data.speedThreshold ? parseInt(data.speedThreshold) : null,
            resolution: data.resolution || null,
            accuracy: data.accuracy ? parseInt(data.accuracy) : null
          },
          is_active: true
        });
      }

      console.log('Success:', result);
      
      const action = activeForm.apiType.split('/')[1];
      alert(`Successfully ${action === 'add' ? 'created' : action === 'edit' ? 'updated' : 'deleted'}!`);
      
      setActiveForm(null);
      clearCoordinates();
      clearEdgeNodes?.();
      onSelectEdgeMode?.(false);
      
      if (onNodesUpdate) {
        onNodesUpdate();
      }
      
      fetchNodes();
      fetchEdges();
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFormCancel = () => {
    setActiveForm(null);
    setError(null);
    clearCoordinates();
    clearEdgeNodes?.();
    onSelectEdgeMode?.(false);
  };

  const handleGenerateTraffic = async () => {
    setLoading(true);
    setTrafficMsg(null);
    
    try {
      const res = await fetch("http://localhost:8000/api/edge/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setTrafficMsg({
          type: 'success',
          text: `✅ Updated ${data.updated || 0} edges with realistic traffic data`
        });
        // Refresh edges after updating traffic
        setTimeout(() => {
          fetchEdges();
        }, 500);
      } else {
        setTrafficMsg({
          type: 'error',
          text: `❌ Error: ${data.message || 'Failed to generate traffic'}`
        });
      }
    } catch (err) {
      console.error("Traffic generation failed", err);
      setTrafficMsg({
        type: 'error',
        text: `❌ Failed: ${err.message}`
      });
    } finally {
      setLoading(false);
      setTimeout(() => setTrafficMsg(null), 4000);
    }
  };

  const handleDVUpdate = async () => {
    setLoading(true);
    setTrafficMsg(null);
    
    try {
      const res = await fetch("http://localhost:8000/api/dv_update_test/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setTrafficMsg({
          type: 'success',
          text: `✅ Routing computed! ${data.updates_applied || 0} routing entries updated`
        });
        // Routing is now available for nodes
        setTimeout(() => {
          fetchEdges();
        }, 500);
      } else {
        setTrafficMsg({
          type: 'error',
          text: `❌ Error: ${data.message || 'Failed to compute routing'}`
        });
      }
    } catch (err) {
      console.error("DV update failed", err);
      setTrafficMsg({
        type: 'error',
        text: `❌ Failed: ${err.message}`
      });
    } finally {
      setLoading(false);
      setTimeout(() => setTrafficMsg(null), 4000);
    }
  };

  const handleClearDatabase = async () => {
    // Ask for confirmation before clearing
    if (!window.confirm('⚠️ WARNING: This will DELETE ALL data (nodes, edges, routing).\n\nThis action CANNOT be undone. Are you sure?')) {
      return;
    }

    setLoading(true);
    setTrafficMsg(null);
    
    try {
      const res = await fetch("http://localhost:8000/api/db/clear-all/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setTrafficMsg({
          type: 'success',
          text: `✅ Database cleared! Deleted ${data.deleted.nodes} nodes, ${data.deleted.edges} edges`
        });
        // Refresh data after clearing
        setTimeout(() => {
          fetchNodes();
          fetchEdges();
          onNodesUpdate?.([]);
        }, 500);
      } else {
        setTrafficMsg({
          type: 'error',
          text: `❌ Error: ${data.message || 'Failed to clear database'}`
        });
      }
    } catch (err) {
      console.error("Database clear failed", err);
      setTrafficMsg({
        type: 'error',
        text: `❌ Failed: ${err.message}`
      });
    } finally {
      setLoading(false);
      setTimeout(() => setTrafficMsg(null), 5000);
    }
  };

  const dropdownConfigs = [
    {
      title: "Node",
      icon: "📍",
      color: "from-purple-600 to-pink-600",
      items: [
        {
          label: "Add",
          description: "Create a new node",
          formConfig: {
            title: "Add Node",
            submitLabel: "Create Node",
            apiType: 'node/add',
            requiresMapClick: true,
            fields: [
              { name: 'name', label: 'Node Name', type: 'text', required: true, placeholder: 'e.g., Main St & 1st Ave' },
              { name: 'latitude', label: 'Latitude', type: 'number', required: true, placeholder: 'Click on map', step: 'any', readOnly: true },
              { name: 'longitude', label: 'Longitude', type: 'number', required: true, placeholder: 'Click on map', step: 'any', readOnly: true },
            ]
          }
        },
        {
          label: "Edit",
          description: "Edit an existing node",
          formConfig: {
            title: "Edit Node",
            submitLabel: "Update Node",
            apiType: 'node/edit',
            requiresNodeSelect: true,
            selectMode: 'edit',
            requiresMapClick: true,
            fields: [
              { name: 'name', label: 'Node Name', type: 'text', required: true, placeholder: 'Update name' },
              { name: 'latitude', label: 'New Latitude', type: 'number', required: true, placeholder: 'Click on map', step: 'any', readOnly: true },
              { name: 'longitude', label: 'New Longitude', type: 'number', required: true, placeholder: 'Click on map', step: 'any', readOnly: true },
              { 
                name: 'is_active', 
                label: 'Status', 
                type: 'select',
                required: true,
                options: [
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' }
                ]
              }
            ]
          }
        },
        {
          label: "Delete",
          description: "Remove a node",
          formConfig: {
            title: "Delete Node",
            submitLabel: "Delete Node",
            apiType: 'node/del',
            requiresNodeSelect: true,
            selectMode: 'delete',
            fields: [
              { name: 'reason', label: 'Reason (optional)', type: 'textarea', placeholder: 'Why are you deleting this node?' }
            ]
          }
        }
      ]
    },
    {
      title: "Edge",
      icon: "🛣️",
      color: "from-blue-600 to-cyan-600",
      items: [
        {
          label: "Add",
          description: "Connect two nodes",
          formConfig: {
            title: "Add Edge (Bidirectional)",
            submitLabel: "Create Edge",
            apiType: 'edge/add',
            requiresEdgeNodeSelect: true,
            fields: [
              { name: 'name', label: 'Road Name', type: 'text', required: true, placeholder: 'e.g., Main Street' },
              { name: 'lanes', label: 'Number of Lanes', type: 'number', required: true, placeholder: '2', min: 1 },
              { name: 'camera_id', label: 'Camera ID (optional)', type: 'text', placeholder: 'Leave empty if none' }
            ]
          }
        },
        {
          label: "Edit",
          description: "Edit an existing edge",
          formConfig: {
            title: "Edit Edge",
            submitLabel: "Update Edge",
            apiType: 'edge/edit',
            requiresEdgeNodeSelect: true,
            fields: [
              { name: 'name', label: 'Road Name', type: 'text', required: true, placeholder: 'Update name' },
              { name: 'lanes', label: 'Number of Lanes', type: 'number', required: true, placeholder: '2', min: 1 },
              { name: 'camera_id', label: 'Camera ID (optional)', type: 'text', placeholder: 'Update camera' },
              { 
                name: 'is_active', 
                label: 'Status', 
                type: 'select',
                required: true,
                options: [
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' }
                ]
              }
            ]
          }
        },
        {
          label: "Delete",
          description: "Remove an edge",
          formConfig: {
            title: "Delete Edge",
            submitLabel: "Delete Edge",
            apiType: 'edge/del',
            requiresEdgeNodeSelect: true,
            fields: [
              { name: 'reason', label: 'Reason (optional)', type: 'textarea', placeholder: 'Why are you deleting this edge?' }
            ]
          }
        }
      ]
    },
    {
      title: "Camera",
      icon: "📷",
      color: "from-green-600 to-emerald-600",
      items: [
        {
          label: "Add",
          description: "Install camera",
          formConfig: {
            title: "Add Camera",
            submitLabel: "Install Camera",
            apiType: 'camera/add',
            fields: [
              { name: 'cameraId', label: 'Camera ID', type: 'text', required: true, placeholder: 'CAM-001' },
              { name: 'edgeId', label: 'Edge ID', type: 'text', required: true, placeholder: 'e_node1_node2' },
              { name: 'position', label: 'Position (%)', type: 'number', required: true, placeholder: '50', step: 'any', min: 0, max: 100 },
              { 
                name: 'cameraType',
                label: 'Type',
                type: 'select',
                required: true,
                options: [
                  { value: 'speed', label: 'Speed' },
                  { value: 'traffic', label: 'Traffic' },
                  { value: 'anpr', label: 'ANPR' }
                ]
              },
              { name: 'speedThreshold', label: 'Speed Threshold (km/h)', type: 'number', placeholder: 'Optional for speed cameras' },
              { 
                name: 'resolution', 
                label: 'Resolution', 
                type: 'select',
                options: [
                  { value: '', label: 'Not specified' },
                  { value: '720p', label: '720p' },
                  { value: '1080p', label: '1080p' },
                  { value: '4k', label: '4K' }
                ]
              }
            ]
          }
        }
      ]
    },
    {
      title: "Traffic & Routing",
      icon: "🚗",
      color: "from-amber-600 to-orange-600",
      items: [
        {
          label: "Generate Test Data",
          description: "Fill all edges with realistic traffic",
          isSpecial: true,
          action: 'generateTraffic'
        },
        {
          label: "Compute Routing (DV)",
          description: "Calculate optimal routes using Distance Vector",
          isSpecial: true,
          action: 'dvUpdate'
        }
      ]
    },
    {
      title: "Database",
      icon: "🗑️",
      color: "from-red-600 to-pink-600",
      items: [
        {
          label: "Clear All Data",
          description: "Delete all nodes, edges, and routing data",
          isSpecial: true,
          action: 'clearDatabase',
          dangerous: true
        }
      ]
    }
  ];

  const handleItemClick = (item) => {
    // Handle special actions
    if (item.isSpecial && item.action === 'generateTraffic') {
      handleGenerateTraffic();
      return;
    }
    
    if (item.isSpecial && item.action === 'dvUpdate') {
      handleDVUpdate();
      return;
    }
    
    if (item.isSpecial && item.action === 'clearDatabase') {
      handleClearDatabase();
      return;
    }

    const formConfig = { ...item.formConfig };
    
    setActiveForm(formConfig);
    
    if (formConfig.requiresMapClick && !formConfig.requiresNodeSelect) {
      console.log('[AddPage] Enabling map click mode for node addition');
      onMapClick();  // Enable map clicking
    } else if (formConfig.requiresNodeSelect) {
      onNodeSelect(formConfig.selectMode || 'edit');
    } else if (formConfig.requiresEdgeNodeSelect) {
      console.log('[AddPage] Enabling edge select mode via onSelectEdgeMode');
      onSelectEdgeMode(true);
    } else if (formConfig.requiresEdgeSelect) {
      onSelectEdgeMode(formConfig.selectMode || 'edit');
    }
  };

  return (
    <div className="absolute left-0 top-0 bottom-0 w-96 bg-zinc-900/95 backdrop-blur-lg border-r border-violet-500/30 shadow-2xl overflow-auto z-50">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Manage Network</h1>
          <p className="text-gray-400 text-sm mt-1">Add, edit, or delete components</p>
        </div>

        {trafficMsg && (
          <div className={`mb-4 p-4 rounded-lg border ${
            trafficMsg.type === 'success' 
              ? 'bg-green-900/50 border-green-700' 
              : 'bg-red-900/50 border-red-700'
          }`}>
            <p className={`text-sm font-medium ${
              trafficMsg.type === 'success' ? 'text-green-200' : 'text-red-200'
            }`}>
              {trafficMsg.text}
            </p>
          </div>
        )}

        {activeForm ? (
          <>
            {/* Edge Selection Indicator */}
            {activeForm.requiresEdgeSelect && !selectedEdge && (
              <div className="mb-4 p-4 bg-cyan-900/50 border border-cyan-700 rounded-lg">
                <p className="text-cyan-200 text-sm font-medium">
                  {activeForm.selectMode === 'delete' ? '🗑️' : '✏️'} Click on an edge on the map to select it
                </p>
              </div>
            )}
            
            {/* Selected Edge Info */}
            {selectedEdge && (
              <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg">
                <p className="text-green-200 text-sm font-medium">✓ Selected: {selectedEdge.name}</p>
                <p className="text-green-300 text-xs mt-1">
                  ID: {selectedEdge.edge_id}
                </p>
                <p className="text-green-300 text-xs">
                  Direction: {selectedEdge.in_node_id} → {selectedEdge.out_node_id}
                </p>
              </div>
            )}
            
            {/* Edge Node Selection Indicator */}
            {activeForm.requiresEdgeNodeSelect && (
              <div className="mb-4 p-4 bg-blue-900/50 border border-blue-700 rounded-lg">
                <p className="text-blue-200 text-sm font-medium">
                  🛣️ Select 2 nodes on the map ({selectedEdgeNodes?.length || 0}/2)
                </p>
                {selectedEdgeNodes && selectedEdgeNodes.length > 0 && (
                  <div className="mt-2 text-xs text-blue-300 space-y-1">
                    {selectedEdgeNodes.map((node, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {idx + 1}
                        </span>
                        <span>{node.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Node Selection Indicator */}
            {activeForm.requiresNodeSelect && !selectedNode && (
              <div className="mb-4 p-4 bg-yellow-900/50 border border-yellow-700 rounded-lg">
                <p className="text-yellow-200 text-sm font-medium">
                  {activeForm.selectMode === 'delete' ? '🗑️' : '✏️'} Click on a node on the map to select it
                </p>
              </div>
            )}
            
            {/* Selected Node Info */}
            {selectedNode && (
              <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg">
                <p className="text-green-200 text-sm font-medium">✓ Selected: {selectedNode.name}</p>
                <p className="text-green-300 text-xs mt-1">
                  ID: {selectedNode.node_id}
                </p>
                <p className="text-green-300 text-xs">
                  Original Position: {selectedNode.location?.lat?.toFixed(4)}, {selectedNode.location?.lng?.toFixed(4)}
                </p>
              </div>
            )}
            
            {/* Map Click Instruction for Edit */}
            {activeForm.requiresMapClick && selectedNode && !selectedCoordinates && (
              <div className="mb-4 p-4 bg-blue-900/50 border border-blue-700 rounded-lg">
                <p className="text-blue-200 text-sm font-medium">📍 Click on the map to set new location</p>
              </div>
            )}

            {/* Map Click Instruction for Add */}
            {activeForm.requiresMapClick && !activeForm.requiresNodeSelect && !selectedCoordinates && (
              <div className="mb-4 p-4 bg-blue-900/50 border border-blue-700 rounded-lg">
                <p className="text-blue-200 text-sm font-medium">📍 Click on the map to select location</p>
              </div>
            )}

            <FormRenderer
              formConfig={activeForm}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              loading={loading}
              error={error}
              selectedCoordinates={selectedCoordinates}
              selectedNode={selectedNode}
              selectedEdgeNodes={selectedEdgeNodes}
              selectedEdge={selectedEdge}
            />
          </>
        ) : (
          <div className="space-y-3">
            {dropdownConfigs.map((config, idx) => (
              <Dropdown
                key={idx}
                title={config.title}
                icon={config.icon}
                color={config.color}
                items={config.items}
                onItemClick={handleItemClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}