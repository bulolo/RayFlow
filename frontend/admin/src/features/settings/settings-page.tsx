'use client';

import { Settings2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { settingsTabs, type SettingsTabKey } from './config';
import {
  AlertChannels,
  DefaultSettings,
  ModelProviders,
  Permissions,
  SettingsShell,
  Users,
} from './components';

const DEFAULT_TAB: SettingsTabKey = 'defaults';
const TAB_PARAM = 'tab';
const settingsTabKeys = new Set<SettingsTabKey>(settingsTabs.map((tab) => tab.key));

function toSettingsTab(value: string | null): SettingsTabKey {
  return value && settingsTabKeys.has(value as SettingsTabKey) ? (value as SettingsTabKey) : DEFAULT_TAB;
}

export function SettingsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = toSettingsTab(searchParams.get(TAB_PARAM));

  function setActiveTab(tab: SettingsTabKey) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set(TAB_PARAM, tab);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  return (
    <main className="flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden px-6 py-6 lg:px-8 animate-in fade-in-50 duration-200">
      <div className="mb-4 shrink-0 flex flex-col gap-2 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-primary shadow-sm">
              <Settings2 className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">配置中心</h1>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            统一维护系统级配置、基础资源、通知能力与租户内账号权限，页面结构对齐任务调度。
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <SettingsShell
          mode="page"
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          tabs={settingsTabs}
        >
          {activeTab === 'alerts' && <AlertChannels />}
          {activeTab === 'users' && <Users />}
          {activeTab === 'permissions' && <Permissions />}
          {activeTab === 'defaults' && <DefaultSettings />}
          {activeTab === 'model-providers' && <ModelProviders />}
        </SettingsShell>
      </div>
    </main>
  );
}
