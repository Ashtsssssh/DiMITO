import { Link } from 'react-router-dom';

export default function Navbar({ currentPath, onOpenRoutingModal }) {
  const navItems = [
    { label: "View", path: "/" },
    { label: "Add", path: "/add" },
    { label: "Page 2", path: "/page2" },
    { label: "Page 3", path: "/page3" },
    { label: "Page 4", path: "/page4" }
  ];

    return (
      <div className="h-16 bg-zinc-900 border-b border-zinc-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-xl font-bold text-violet-400">DiMITO</div>
          <div className="flex gap-2 ml-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  currentPath === item.path
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        
        {/* Routing Button */}
        {onOpenRoutingModal && (
          <button
            onClick={onOpenRoutingModal}
            className="px-4 py-2 rounded-lg font-medium transition-all bg-blue-600 text-white shadow-lg hover:bg-blue-700"
            title="Open routing analyzer - Select starting node"
          >
            🛣️ Routing Analyzer
          </button>
        )}
      </div>
    );
}