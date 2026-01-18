import { useState } from "react";
import { createNode } from "../api/nodes";

export default function AddNodeDashboard({ lat, lng, onSuccess, onCancel }) {
  const [nodeId, setNodeId] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!nodeId || !name) return setMsg("Node ID & Name required");

    setLoading(true);
    try {
      await createNode({
        node_id: nodeId,
        name,
        location: { latitude: lat, longitude: lng },
        is_active: isActive,
      });
      onSuccess();
    } catch {
      setMsg("Failed to create node");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={panel}>
      <h3>Add Node</h3>
      <p>lat: {lat.toFixed(5)}, lng: {lng.toFixed(5)}</p>
      <form onSubmit={submit}>
        <input placeholder="Node ID" value={nodeId} onChange={e => setNodeId(e.target.value)} />
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <label>
          <input type="checkbox" checked={isActive} onChange={() => setIsActive(!isActive)} />
          Active
        </label>
        <button disabled={loading}>Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  );
}

const panel = {
  position: "absolute",
  right: 20,
  top: 20,
  background: "white",
  padding: 12,
  zIndex: 2000,
};
