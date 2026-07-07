'use client';

import { useState } from 'react';
import { Building2, Server, ShieldCheck } from 'lucide-react';
import { PlatformRuntimes } from './platform-runtimes';
import { Tenants } from './tenants';
import { useUIStore } from '@/stores/ui-store';
import { SettingsShell, type SettingsTab } from '@/features/settings/components';

type PlatformTabKey = 'tenants' | 'clusters';

const platformTabs: Array<SettingsTab<PlatformTabKey>> = [
  {
    key: 'tenants',
    label: '组织管理',
    description: '组织开通、状态维护与租户生命周期管理',
    group: '资源',
    icon: Building2,
  },
  {
    key: 'clusters',
    label: '内置运行时',
    description: '平台共享运行时查看与连通性巡检',
    group: '资源',
    icon: Server,
  },
];

export function Platform() {
  const open = useUIStore((state) => state.platformOpen);
  const onOpenChange = useUIStore((state) => state.setPlatformOpen);
  const [activeTab, setActiveTab] = useState<PlatformTabKey>('tenants');

  return (
    <SettingsShell
      open={open}
      onOpenChange={onOpenChange}
      title="平台设置"
      headerIcon={<ShieldCheck className="h-4.5 w-4.5 text-amber-600" />}
      headerIconWrapperClassName="bg-amber-50"
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      tabs={platformTabs}
    >
      {activeTab === 'tenants' && <Tenants />}
      {activeTab === 'clusters' && <PlatformRuntimes />}
    </SettingsShell>
  );
}
