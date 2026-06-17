const API_BASE_URL = 'http://localhost:8000/api';

// Helper function for API calls
async function apiCall(endpoint, method = 'GET', data = null) {
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `API Error: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// NODE APIs
// ============================================================================

export const nodeAPI = {
  getAll: async () => {
    return apiCall('/node/get_all', 'GET');
  },

  add: async (nodeData) => {
    return apiCall('/node/add', 'POST', {
      node_id: nodeData.node_id,
      name: nodeData.name,
      location: {
        lat: parseFloat(nodeData.location.lat),
        lng: parseFloat(nodeData.location.lng),
      },
      is_active: nodeData.is_active ?? true
    });
  },

  edit: async (nodeData) => {
    return apiCall('/node/edit', 'POST', {
      node_id: nodeData.node_id,
      name: nodeData.name,
      location: {
        lat: parseFloat(nodeData.location.lat),
        lng: parseFloat(nodeData.location.lng),
      },
      is_active: nodeData.is_active ?? true
    });
  },

  delete: async (nodeId, reason = '') => {
    return apiCall('/node/del', 'POST', {
      node_id: nodeId,
      reason
    });
  }
};

// ============================================================================
// EDGE APIs
// ============================================================================

export const edgeAPI = {
  getAll: async () => {
    return apiCall('/edge/get_all', 'GET');
  },

  add: async (edgeData) => {
    return apiCall('/edge/add', 'POST', {
      edge_id: edgeData.edge_id,
      name: edgeData.name,
      in_node_id: edgeData.in_node_id,
      out_node_id: edgeData.out_node_id,
      camera_id: edgeData.camera_id || '',
      road_length_m: parseFloat(edgeData.road_length_m),
      road_width_m: parseFloat(edgeData.road_width_m),
      is_active: edgeData.is_active ?? true
    });
  },

  edit: async (edgeData) => {
    return apiCall('/edge/edit', 'POST', {
      edge_id: edgeData.edge_id,
      name: edgeData.name,
      in_node_id: edgeData.in_node_id,
      out_node_id: edgeData.out_node_id,
      camera_id: edgeData.camera_id || '',
      road_length_m: parseFloat(edgeData.road_length_m),
      road_width_m: parseFloat(edgeData.road_width_m),
      is_active: edgeData.is_active ?? true
    });
  },

  delete: async (edgeId) => {
    return apiCall('/edge/del', 'POST', {
      edge_id: edgeId
    });
  },

  addBidirectional: async (node1Id, node2Id, edgeData) => {
    const edge1 = await edgeAPI.add({
      edge_id: `e_${node1Id}_${node2Id}`,
      name: edgeData.name || `${node1Id} → ${node2Id}`,
      in_node_id: node1Id,
      out_node_id: node2Id,
      camera_id: edgeData.camera_id || '',
      road_length_m: edgeData.road_length_m,
      road_width_m: edgeData.road_width_m,
    });

    const edge2 = await edgeAPI.add({
      edge_id: `e_${node2Id}_${node1Id}`,
      name: edgeData.name || `${node2Id} → ${node1Id}`,
      in_node_id: node2Id,
      out_node_id: node1Id,
      camera_id: edgeData.camera_id || '',
      road_length_m: edgeData.road_length_m,
      road_width_m: edgeData.road_width_m,
    });

    return { edge1, edge2 };
  }
};

// ============================================================================
// CAMERA APIs
// ============================================================================

export const cameraAPI = {
  getAll: async () => {
    return apiCall('/camera/get_all', 'GET');
  },

  add: async (cameraData) => {
    return apiCall('/camera/add', 'POST', {
      camera_id: cameraData.camera_id,
      edge_id: cameraData.edge_id,
      position: parseFloat(cameraData.position),
      type: cameraData.type || 'traffic',
      settings: cameraData.settings || {},
      is_active: cameraData.is_active ?? true
    });
  }
};

// ============================================================================
// ROUTING APIs
// ============================================================================

export const routingAPI = {
  getRoutingTable: async (nodeId) => {
    return apiCall(`/gettable/node/${nodeId}/`, 'GET');
  }
};

// ============================================================================
// UTILITY
// ============================================================================

export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};