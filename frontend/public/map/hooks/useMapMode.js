import { useState } from "react";

export function useMapMode() {
  const [mode, setMode] = useState("view"); // "view" | "add-node"

  return {
    mode,
    setViewMode: () => setMode("view"),
    setAddNodeMode: () => setMode("add-node"),
  };
}
