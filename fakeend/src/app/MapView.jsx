import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { useNodes } from "../hooks/useNodes";
import AddNodeDashboard from "../overlays/AddNodeDashboard";

export default function MapView() {
  const mapRef = useRef(null);
  const canvasRef = useRef(null);
  const mapDivRef = useRef(null);

  const { nodes, refetchNodes } = useNodes();
  const [mode, setMode] = useState("VIEW");
  const [pendingNode, setPendingNode] = useState(null);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapDivRef.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [77.5946, 12.9716],
      zoom: 15,
    });

    mapRef.current = map;

    map.on("click", (e) => {
      if (mode === "ADD_NODE") {
        setPendingNode({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    map.on("load", draw);
    map.on("move", draw);
    map.on("zoom", draw);

    return () => map.remove();
  }, [mode, nodes]);

  const draw = () => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !map.loaded()) return;

    const ctx = canvas.getContext("2d");
    canvas.width = map.getCanvas().width;
    canvas.height = map.getCanvas().height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    nodes.forEach((n) => {
      const p = map.project([n.location.longitude, n.location.latitude]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "blue";
      ctx.fill();
      ctx.fillText(n.node_id, p.x + 8, p.y - 8);
    });
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      <button style={btn} onClick={() => setMode("ADD_NODE")}>
        ➕ Add Node
      </button>

      {pendingNode && (
        <AddNodeDashboard
          lat={pendingNode.lat}
          lng={pendingNode.lng}
          onCancel={() => setPendingNode(null)}
          onSuccess={() => {
            setPendingNode(null);
            refetchNodes();
          }}
        />
      )}
    </div>
  );
}

const btn = {
  position: "absolute",
  top: 10,
  left: 10,
  zIndex: 2000,
};
