export default function FormRenderer({
  formConfig,
  onSubmit,
  onCancel,
  loading,
  error,
  selectedCoordinates,
  selectedNode,
  selectedEdgeNodes,
  selectedEdge,
  resolvedEdge,   // The DB edge found via node-pair match (edge/edit flow)
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Override with selected coordinates if they exist
    if (selectedCoordinates) {
      data.latitude = selectedCoordinates.lat;
      data.longitude = selectedCoordinates.lng;
    }
    
    // Convert boolean strings
    if (data.is_active === 'true') data.is_active = true;
    if (data.is_active === 'false') data.is_active = false;
    
    onSubmit(data);
  };

  return (
    <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
      <h3 className="text-xl font-bold text-white mb-4">{formConfig.title}</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {formConfig.fields.map((field, idx) => {
          // Auto-fill coordinates from map click or selected node
          let value = undefined;
          
          if (field.name === 'latitude') {
            if (selectedCoordinates) {
              value = selectedCoordinates.lat;
            } else if (selectedNode && !selectedCoordinates) {
              value = selectedNode.location?.lat;
            }
          } else if (field.name === 'longitude') {
            if (selectedCoordinates) {
              value = selectedCoordinates.lng;
            } else if (selectedNode && !selectedCoordinates) {
              value = selectedNode.location?.lng;
            }
          } else if (field.name === 'name' && selectedNode && formConfig.apiType === 'node/edit') {
            value = selectedNode.name;
          } else if (field.name === 'is_active' && selectedNode && formConfig.apiType === 'node/edit') {
            value = selectedNode.is_active ? 'true' : 'false';
          } else if (field.name === 'name' && selectedEdge && formConfig.apiType === 'edge/edit') {
            value = selectedEdge.name;
          } else if (field.name === 'road_length_m' && selectedEdge && formConfig.apiType === 'edge/edit') {
            value = selectedEdge.road_length_m;
          } else if (field.name === 'road_width_m' && selectedEdge && formConfig.apiType === 'edge/edit') {
            value = selectedEdge.road_width_m;
          } else if (field.name === 'lanes' && formConfig.apiType === 'edge/edit') {
            // Prefer resolvedEdge (found via node-pair) over selectedEdge (found via direct click).
            // resolvedEdge is the reliable source for the node-pair edge/edit flow;
            // selectedEdge is only set when the user clicks an edge directly on the map.
            const edgeSrc = resolvedEdge || selectedEdge;
            if (edgeSrc) value = edgeSrc.num_lanes;
          } else if (field.name === 'camera_id' && selectedEdge && formConfig.apiType === 'edge/edit') {
            value = selectedEdge.camera_id;
          } else if (field.name === 'is_active' && selectedEdge && formConfig.apiType === 'edge/edit') {
            value = selectedEdge.is_active ? 'true' : 'false';
          }

          return (
            <div key={idx}>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {field.label}
                {field.required && <span className="text-red-400">*</span>}
              </label>
              
              {field.type === 'text' || field.type === 'number' ? (
                <input
                  type={field.type}
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  disabled={loading}
                  readOnly={field.readOnly}
                  defaultValue={value}
                  key={`${field.name}-${value}`} // Force re-render when value changes
                  className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 ${
                    field.readOnly ? 'cursor-not-allowed bg-zinc-800' : ''
                  }`}
                />
              ) : field.type === 'select' ? (
                <select
                  name={field.name}
                  required={field.required}
                  disabled={loading}
                  defaultValue={value}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                >
                  <option value="">Select {field.label}</option>
                  {field.options?.map((opt, i) => (
                    <option key={i} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={3}
                  disabled={loading}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                />
              ) : null}
            </div>
          );
        })}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || (formConfig.requiresMapClick && !selectedCoordinates) || (formConfig.requiresEdgeNodeSelect && selectedEdgeNodes?.length < 2)}
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : (formConfig.submitLabel || 'Submit')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-6 bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}