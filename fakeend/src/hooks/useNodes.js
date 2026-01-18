import { useEffect, useState } from "react";
import { fetchNodes } from "../api/nodes";

export function useNodes() {
  const [nodes, setNodes] = useState([]);

  const refetchNodes = async () => {
    const data = await fetchNodes();
    setNodes(data);
  };

  useEffect(() => {
    refetchNodes();
  }, []);

  return { nodes, refetchNodes };
}
