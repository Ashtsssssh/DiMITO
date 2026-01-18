import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function Sidebar({ open, onClose }) {
  const [nodeOpen, setNodeOpen] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div className="absolute left-0 top-0 h-full w-72 bg-zinc-950 border-r border-zinc-800 p-4">
        <h2 className="text-lg font-semibold text-violet-200 mb-6">
          Add / Edit
        </h2>

        {/* NODE DROPDOWN */}
        <div>
          <button
            onClick={() => setNodeOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-left"
          >
            <span className="text-sm font-medium">Node</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                nodeOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {nodeOpen && (
            <div className="mt-2 ml-2 flex flex-col gap-1">
              <SidebarItem label="Add Node" />
              <SidebarItem label="Edit Node" />
              <SidebarItem label="Delete Node" />
            </div>
          )}
        </div>

        {/* Placeholder for future sections */}
        <div className="mt-6 text-xs text-zinc-500">
          More tools coming…
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 text-sm rounded-md bg-zinc-900 hover:bg-violet-600/20 text-zinc-200 hover:text-violet-200 transition"
    >
      {label}
    </button>
  );
}
