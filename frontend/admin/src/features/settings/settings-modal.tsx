'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { settingsTabs, type SettingsTabKey } from './config';
import {
  AlertChannels,
  DefaultSettings,
  ModelProviders,
  Permissions,
  SettingsShell,
  Users,
} from './components';

export function SettingsModal() {
  const open = useUIStore((state) => state.settingsOpen);
  const onOpenChange = useUIStore((state) => state.setSettingsOpen);
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('defaults');

  if (!open) return null;

  return (
    <SettingsShell
      open={open}
      onOpenChange={onOpenChange}
      title="系统设置"
      headerIcon={<Settings className="h-4 w-4 text-primary" />}
      headerIconWrapperClassName="bg-primary/10"
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
  );
}
