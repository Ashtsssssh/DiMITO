import { useNetworkStore } from '@/stores/networkStore';
import { VisualizationMode } from '@/types/network';
import { cn } from '@/lib/utils';
import { Network, Route, Activity, Lightbulb, Settings } from 'lucide-react';

const modes: Array<{
  value: VisualizationMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    value: 'network',
    label: 'Network',
    icon: <Network className="w-4 h-4" />,
    description: 'Overview of all intersections',
  },
  {
    value: 'routing',
    label: 'Routing',
    icon: <Route className="w-4 h-4" />,
    description: 'Path probabilities visualization',
  },
  {
    value: 'traffic',
    label: 'Traffic',
    icon: <Activity className="w-4 h-4" />,
    description: 'Queue and congestion state',
  },
  {
    value: 'signal',
    label: 'Signal',
    icon: <Lightbulb className="w-4 h-4" />,
    description: 'Green/red timing cycles',
  },
  {
    value: 'admin',
    label: 'Admin',
    icon: <Settings className="w-4 h-4" />,
    description: 'Add/edit nodes and edges',
  },
];

export default function ModeSelector() {
  const { mode, setMode } = useNetworkStore();

  return (
    <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm rounded-lg p-1 border border-border">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => setMode(m.value)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200",
            "text-sm font-medium",
            mode === m.value
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
          title={m.description}
        >
          {m.icon}
          <span className="hidden md:inline">{m.label}</span>
        </button>
      ))}
    </div>
  );
}