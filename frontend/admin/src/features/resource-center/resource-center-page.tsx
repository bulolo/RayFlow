'use client';

import { DatabaseZap } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ConnectionTab } from '@/features/resource-center/lib/resource-center-forms';
import { ResourceConnectionTabs, resourceTabs } from '@/features/resource-center/components/resource-connection-tabs';
import { FlinkJarResourcesPanel } from '@/features/resource-center/panels/flink-jar-resources-panel';
import { FlinkRuntimePanel } from '@/features/resource-center/panels/flink-runtime-panel';
import { FlussConnectionsPanel } from '@/features/resource-center/panels/fluss-connections-panel';
import { PaimonConnectionsPanel } from '@/features/resource-center/panels/paimon-connections-panel';
import { StarRocksConnectionsPanel } from '@/features/resource-center/panels/starrocks-connections-panel';

const DEFAULT_TAB: ConnectionTab = 'flink';
const TAB_PARAM = 'tab';
const connectionTabKeys = new Set<ConnectionTab>(resourceTabs.map((tab) => tab.key));

function toConnectionTab(value: string | null): ConnectionTab {
  return value && connectionTabKeys.has(value as ConnectionTab) ? (value as ConnectionTab) : DEFAULT_TAB;
}

export function ResourceCenterPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConnectionTab = toConnectionTab(searchParams.get(TAB_PARAM));

  function setActiveConnectionTab(tab: ConnectionTab) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set(TAB_PARAM, tab);

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  return (
    <main className="flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden px-6 py-5 lg:px-8 animate-in fade-in-50 duration-200">
      <div className="mb-4 shrink-0 flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-primary shadow-sm">
              <DatabaseZap className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">资源中心</h1>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">统一维护连接资源，并在连接之上管理与浏览 Catalog、Topic、库表、Schema 和数据预览。</p>
        </div>
      </div>

      <ResourceConnectionTabs activeTab={activeConnectionTab} onTabChange={setActiveConnectionTab}>
        {activeConnectionTab === 'paimon' ? (
          <PaimonConnectionsPanel />
        ) : null}
        {activeConnectionTab === 'fluss' ? (
          <FlussConnectionsPanel />
        ) : null}
        {activeConnectionTab === 'starrocks' ? (
          <StarRocksConnectionsPanel />
        ) : null}
        {activeConnectionTab === 'flink' ? (
          <FlinkRuntimePanel />
        ) : null}
        {activeConnectionTab === 'flink-jars' ? (
          <FlinkJarResourcesPanel />
        ) : null}
      </ResourceConnectionTabs>
    </main>
  );
}
