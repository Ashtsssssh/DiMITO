import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function Dropdown({ title, icon, color, items, onItemClick }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full">
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-gradient-to-r ${color} p-5 rounded-lg text-left hover:shadow-xl transition-all duration-200 ${
          isOpen ? 'rounded-b-none' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-3xl mb-2">{icon}</div>
            <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
          </div>
          {isOpen ? (
            <ChevronUp className="w-6 h-6 text-white" />
          ) : (
            <ChevronDown className="w-6 h-6 text-white" />
          )}
        </div>
      </button>

      {/* Dropdown Items */}
      {isOpen && (
        <div className="bg-zinc-800 border-x border-b border-zinc-700 rounded-b-lg overflow-hidden">
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                onItemClick(item);
                setIsOpen(false);
              }}
              className="w-full px-5 py-3 text-left hover:bg-zinc-700 transition-colors border-b border-zinc-700 last:border-b-0"
            >
              <div className="text-white font-medium">{item.label}</div>
              {item.description && (
                <div className="text-gray-400 text-xs mt-1">{item.description}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}