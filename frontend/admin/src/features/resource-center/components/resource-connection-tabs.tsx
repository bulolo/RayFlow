import type { ReactNode } from 'react';
import { Database, Network, Package, Server, Waypoints } from 'lucide-react';
import type { ConnectionTab } from '@/features/resource-center/lib/resource-center-forms';
import { cn } from '@/lib/utils';

export const resourceTabs: Array<{ icon: typeof Database; key: ConnectionTab; label: string }> = [
  { key: 'paimon', label: 'Paimon', icon: Database },
  { key: 'fluss', label: 'Fluss 集群', icon: Network },
  { key: 'starrocks', label: 'StarRocks', icon: Server },
  { key: 'flink', label: 'Flink 运行时', icon: Waypoints },
  { key: 'flink-jars', label: 'Flink JAR', icon: Package },
];

export function ResourceConnectionTabs({
  activeTab,
  children,
  onTabChange,
}: {
  activeTab: ConnectionTab;
  children: ReactNode;
  onTabChange: (tab: ConnectionTab) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-border/50 bg-white px-6 py-5 lg:px-8">
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border-subtle pt-1 px-1 pb-3">
        {resourceTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors',
                active ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pt-5">{children}</div>
    </div>
  );
}
