export default function Navbar({ currentPath, onNavigate }) {
  const navItems = [
    { label: "View", path: "/" },
    { label: "Add", path: "/add" },
    { label: "Page 2", path: "/page2" },
    { label: "Page 3", path: "/page3" },
    { label: "Page 4", path: "/page4" }
  ];

  return (
    <div className="h-16 bg-zinc-900 border-b border-zinc-800 px-6 flex items-center gap-4">
      <div className="text-xl font-bold text-violet-400">DiMITO</div>
      
      <div className="flex gap-2 ml-6">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              currentPath === item.path
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}