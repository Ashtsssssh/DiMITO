import { useState } from "react";
import { X } from "lucide-react";

export default function AddNodeForm({ open, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    node_id: "",
    name: "",
    latitude: "",
    longitude: "",
    cycle_time: "",
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        node_id: formData.node_id,
        name: formData.name,
        is_active: formData.is_active,
      };

      // Add location if coordinates are provided
      if (formData.latitude && formData.longitude) {
        payload.location = {
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
        };
      }

      // Add cycle_time if provided (otherwise backend auto-calculates)
      if (formData.cycle_time) {
        payload.cycle_time = parseInt(formData.cycle_time, 10);
      }

      const response = await fetch("/api/node/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add node");
      }

      const data = await response.json();
      
      // Reset form
      setFormData({
        node_id: "",
        name: "",
        latitude: "",
        longitude: "",
        cycle_time: "",
        is_active: true,
      });

      onSuccess?.(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4">
      <div
        className="bg-zinc-900 rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-xl font-semibold text-white">Add New Node</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Node ID */}
          <div>
            <label htmlFor="node_id" className="block text-sm font-medium text-zinc-300 mb-2">
              Node ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="node_id"
              name="node_id"
              value={formData.node_id}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="e.g., NODE001"
            />
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-2">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="e.g., Main Distribution Center"
            />
          </div>

          {/* Location - Latitude */}
          <div>
            <label htmlFor="latitude" className="block text-sm font-medium text-zinc-300 mb-2">
              Latitude (Optional)
            </label>
            <input
              type="number"
              id="latitude"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              step="any"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="e.g., 22.3072"
            />
          </div>

          {/* Location - Longitude */}
          <div>
            <label htmlFor="longitude" className="block text-sm font-medium text-zinc-300 mb-2">
              Longitude (Optional)
            </label>
            <input
              type="number"
              id="longitude"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              step="any"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="e.g., 73.1812"
            />
          </div>

          {/* Cycle Time */}
          <div>
            <label htmlFor="cycle_time" className="block text-sm font-medium text-zinc-300 mb-2">
              Cycle Time in seconds (Optional)
            </label>
            <input
              type="number"
              id="cycle_time"
              name="cycle_time"
              value={formData.cycle_time}
              onChange={handleChange}
              min="0"
              step="1"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="Leave empty for auto (30 × edges)"
            />
          </div>

          {/* Is Active */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="w-4 h-4 bg-zinc-800 border-zinc-700 rounded text-violet-600 focus:ring-2 focus:ring-violet-500"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-zinc-300">
              Node is active
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Adding..." : "Add Node"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}