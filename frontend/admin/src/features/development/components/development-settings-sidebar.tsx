'use client';

import type { FlinkRuntimeResponse, FlinkJobResponse, FlinkJobRequest } from '@/shared/api/generated';
import {
  AlertSettingsPanel,
  CommandPreviewPanel,
  HistoryPanel,
  JobInfoPanel,
  SavepointsPanel,
  SettingsPanel,
  VersionsPanel,
} from '@/features/development/components/job-side-panels';
import { RightPanelTabs, type RightPanelTab } from '@/features/development/components/panel-rails';

interface DevelopmentSettingsSidebarProps {
  clusterAddress?: string;
  clusterList: FlinkRuntimeResponse[];
  draft: FlinkJobRequest;
  groupOptions: string[];
  isRunning: boolean;
  onChangeDraft: (value: FlinkJobRequest) => void;
  onPublish: (remark?: string) => void;
  onTriggerSavepoint: () => void;
  onToggle: () => void;
  rightPanelTab: RightPanelTab;
  selectedJob: FlinkJobResponse | null;
  setRightPanelTab: (tab: RightPanelTab) => void;
  settingsCollapsed: boolean;
  settingsWidth: number;
  publishPending: boolean;
}

function rightPanelTitle(tab: RightPanelTab) {
  if (tab === 'config') return '作业配置';
  if (tab === 'alerts') return '告警配置';
  if (tab === 'command') return '提交命令';
  if (tab === 'versions') return '历史版本';
  if (tab === 'savepoints') return '保存点';
  if (tab === 'history') return '执行记录';
  return '作业信息';
}

export function DevelopmentSettingsSidebar({
  clusterAddress,
  clusterList,
  draft,
  groupOptions,
  isRunning,
  onChangeDraft,
  onPublish,
  onToggle,
  onTriggerSavepoint,
  rightPanelTab,
  selectedJob,
  setRightPanelTab,
  settingsCollapsed,
  settingsWidth,
  publishPending,
}: DevelopmentSettingsSidebarProps) {
  return (
    <aside
      className="flex min-h-0 border-l border-slate-200 bg-zinc-50/50"
      style={{ width: settingsCollapsed ? 56 : settingsWidth }}
    >
      {!settingsCollapsed ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center border-b border-slate-200 bg-slate-50/50 px-3 backdrop-blur-sm">
            <div className="text-xs font-semibold text-slate-500">{rightPanelTitle(rightPanelTab)}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {rightPanelTab === 'config' ? (
              <SettingsPanel draft={draft} clusterList={clusterList} groupOptions={groupOptions} onChange={onChangeDraft} />
            ) : null}
            {rightPanelTab === 'alerts' ? <AlertSettingsPanel draft={draft} onChange={onChangeDraft} /> : null}
            {rightPanelTab === 'command' ? <CommandPreviewPanel draft={draft} /> : null}
            {rightPanelTab === 'versions' ? <VersionsPanel job={selectedJob} draft={draft} onPublish={onPublish} publishPending={publishPending} /> : null}
            {rightPanelTab === 'savepoints' ? (
              <SavepointsPanel
                draft={draft}
                isRunning={isRunning}
                job={selectedJob}
                onChange={onChangeDraft}
                onTrigger={onTriggerSavepoint}
                clusterAddress={clusterAddress}
              />
            ) : null}
            {rightPanelTab === 'history' ? <HistoryPanel job={selectedJob} /> : null}
            {rightPanelTab === 'info' ? <JobInfoPanel job={selectedJob} clusterAddress={clusterAddress} /> : null}
          </div>
        </div>
      ) : null}
      <RightPanelTabs
        activeTab={rightPanelTab}
        collapsed={settingsCollapsed}
        onChange={(tab) => {
          setRightPanelTab(tab);
          if (settingsCollapsed) onToggle();
        }}
        onToggle={onToggle}
      />
    </aside>
  );
}
