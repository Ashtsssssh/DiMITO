import { Link } from 'react-router-dom';
import { Navigation, Activity } from 'lucide-react';

export default function Navbar({ currentPath, onOpenRoutingModal, onOpenSignalModal }) {
  const isActive = (path) => currentPath === path;

  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left: App Title */}
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-white">Traffic Control System</h1>
          
          {/* Navigation Links */}
          <div className="flex items-center gap-2">
            <Link
              to="/add"
              className={`px-4 py-2 rounded-lg font-medium transition ${
                isActive('/add')
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-300 hover:bg-zinc-800'
              }`}
            >
              Add
            </Link>
            <Link
              to="/page2"
              className={`px-4 py-2 rounded-lg font-medium transition ${
                isActive('/page2')
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-300 hover:bg-zinc-800'
              }`}
            >
              Signals
            </Link>
            <Link
              to="/page3"
              className={`px-4 py-2 rounded-lg font-medium transition ${
                isActive('/page3')
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-300 hover:bg-zinc-800'
              }`}
            >
              Page 3
            </Link>
            <Link
              to="/page4"
              className={`px-4 py-2 rounded-lg font-medium transition ${
                isActive('/page4')
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-300 hover:bg-zinc-800'
              }`}
            >
              Page 4
            </Link>
          </div>
        </div>

        {/* Right: Visualizer Buttons */}
        <div className="flex items-center gap-3">
          {/* Routing Analyzer Button */}
          <button
            onClick={onOpenRoutingModal}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            Routing Analyzer
          </button>

          {/* ✅ NEW: Signal Schedule Button */}
          <button
            onClick={onOpenSignalModal}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Signal Schedule
          </button>
        </div>
      </div>
    </nav>
  );
}