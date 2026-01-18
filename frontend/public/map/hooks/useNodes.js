import { useEffect, useState } from "react";
import { fetchNodes, createNode } from "@/api/map/nodes.api";

export function useNodes() {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    fetchNodes()
      .then(setNodes)
      .catch(console.error);
  }, []);

    async function addNode(node) {
        const saved = await createNode(node);   // throws if failed
        setNodes((prev) => [...prev, saved]);
        return saved;                            // ✅ success signal
    }

    return { nodes, addNode };
    }
