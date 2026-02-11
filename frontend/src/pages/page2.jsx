import { useEffect, useRef, useState } from "react";

export default function Page2({ onSignalUpdate }) {
  const [nodes, setNodes] = useState([]);
  const [signals, setSignals] = useState({});
  const timersRef = useRef({});
  const refetchTriggeredRef = useRef({});

  useEffect(() => {
    fetch("http://localhost:8000/api/node/get_all")
      .then(r => r.json())
      .then(setNodes);
  }, []);

  const fetchSignalState = async (nodeId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/signal/${nodeId}/`);
      if (!res.ok) {
        console.warn(`Signal fetch failed for ${nodeId}: ${res.status}`);
        return;
      }

      const data = await res.json();
      data.localFetchTime = Math.floor(Date.now() / 1000);
      data.prefetched = false;

      setSignals(p => ({ ...p, [nodeId]: data }));
      onSignalUpdate(p => ({ ...p, [nodeId]: data }));
      
      // Reset refetch trigger for this node
      refetchTriggeredRef.current[nodeId] = false;
      
      console.log(`🔄 Refetched signal for node ${nodeId}, remaining: ${data.remaining_time}s`);
    } catch (error) {
      console.warn(`Signal fetch error for ${nodeId}:`, error);
    }
  };

  useEffect(() => {
    nodes.forEach(node => {
      // Initial fetch
      fetchSignalState(node.node_id);

      if (timersRef.current[node.node_id]) return;

      // Update countdown every second
      timersRef.current[node.node_id] = setInterval(() => {
        setSignals(prev => {
          const st = prev[node.node_id];
          if (!st) return prev;

          const now = Math.floor(Date.now() / 1000);
          const elapsed = now - st.localFetchTime;
          const remaining = Math.max(0, st.remaining_time - elapsed);

          // Refetch when 5 seconds left (frontend refetch point)
          if (remaining <= 5 && !refetchTriggeredRef.current[node.node_id]) {
            refetchTriggeredRef.current[node.node_id] = true;
            console.log(`⚡ Triggering refetch for node ${node.node_id} (${remaining}s remaining)`);
            fetchSignalState(node.node_id);
          }

          // Full refetch when countdown reaches 0
          if (remaining <= 0) {
            console.log(`🔔 Countdown ended for node ${node.node_id}, fetching new signal`);
            fetchSignalState(node.node_id);
          }

          return {
            ...prev,
            [node.node_id]: { ...st, remainingComputed: remaining }
          };
        });
      }, 1000);
    });

    return () => Object.values(timersRef.current).forEach(clearInterval);
  }, [nodes]);

  return (
    <div className="absolute top-0 right-0 h-full w-[420px] bg-zinc-900 border-l border-zinc-800 overflow-y-auto p-4">
      <h2 className="text-lg font-semibold text-violet-400 mb-4">
        🚦 Green Time Simulation
      </h2>

      {nodes.map(n => {
        const s = signals[n.node_id];
        if (!s) return null;

        const rem = Math.ceil(s.remainingComputed ?? s.remaining_time);
        const isAlert = rem <= 5;

        return (
          <div key={n.node_id} className="mb-4 p-4 bg-zinc-800 rounded-lg">
            <div className="flex justify-between">
              <div>
                <div className="text-white">{n.name}</div>
                <div className="text-xs text-gray-400">
                  Green: {s.current_green}
                </div>
              </div>
              <div className={`text-2xl font-bold ${isAlert ? "text-red-400 animate-pulse" : "text-green-400"}`}>
                {rem}s
              </div>
            </div>

            <div className="mt-3 space-y-1">
              {s.phases.map(p => (
                <div
                  key={p.edge}
                  className={`flex justify-between px-3 py-1 rounded text-sm ${
                    p.edge === s.current_green
                      ? "bg-green-600 text-white"
                      : "bg-zinc-700 text-gray-300"
                  }`}
                >
                  <span>{p.edge}</span>
                  <span>{p.green}s</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
