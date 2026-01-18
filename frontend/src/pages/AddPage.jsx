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
  onEdgeNodeSelect
}) {
  const [activeForm, setActiveForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    fetchNodes();
  }, []);

  useEffect(() => {
    if (selectedNode) {
      fetchNodes();
    }
  }, [selectedNode]);

  const fetchNodes = async () => {
    try {
      const data = await nodeAPI.getAll();
      setNodes(data);
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    }
  };

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
      
      if (onNodesUpdate) {
        onNodesUpdate();
      }
      
      fetchNodes();
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
    }
  ];

  const handleItemClick = (item) => {
    const formConfig = { ...item.formConfig };
    
    setActiveForm(formConfig);
    
    if (formConfig.requiresMapClick && !formConfig.requiresNodeSelect) {
      onMapClick();
    } else if (formConfig.requiresNodeSelect) {
      onNodeSelect(formConfig.selectMode || 'edit');
    } else if (formConfig.requiresEdgeNodeSelect) {
      onEdgeNodeSelect();
    }
  };

  return (
    <div className="absolute left-0 top-0 bottom-0 w-96 bg-zinc-900/95 backdrop-blur-lg border-r border-violet-500/30 shadow-2xl overflow-auto z-50">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Manage Network</h1>
          <p className="text-gray-400 text-sm mt-1">Add, edit, or delete components</p>
        </div>

        {activeForm ? (
          <>
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