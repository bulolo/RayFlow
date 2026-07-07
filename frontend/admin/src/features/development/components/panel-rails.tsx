import {
  Bell,
  Braces,
  Code2,
  Camera,
  CheckSquare,
  FileCode2,
  History,
  Info,
  ListChecks,
  RefreshCw,
  Settings2,
  Tags,
  TerminalSquare,
} from 'lucide-react';
import { Tooltip } from '@/components/ui';

export type RightPanelTab = 'config' | 'alerts' | 'command' | 'versions' | 'savepoints' | 'history' | 'info';
export type LeftPanelTab = 'jobs' | 'variables';
export type DevelopmentViewMode = 'develop' | 'ops';
type LeftPanelTabsProps = {
  activeTab: LeftPanelTab;
  collapsed: boolean;
  onChange: (tab: LeftPanelTab) => void;
  onOpsSelectionModeChange: (enabled: boolean) => void;
  onModeChange: (mode: DevelopmentViewMode) => void;
  onRefresh: () => void;
  onToggle: () => void;
  opsSelectionMode: boolean;
  refreshing: boolean;
  viewMode: DevelopmentViewMode;
};

type RightPanelTabsProps = {
  activeTab: RightPanelTab;
  collapsed?: boolean;
  onChange: (tab: RightPanelTab) => void;
  onToggle: () => void;
};

export function LeftPanelTabs({
  activeTab,
  collapsed,
  onChange,
  onOpsSelectionModeChange,
  onModeChange,
  onRefresh,
  onToggle,
  opsSelectionMode,
  refreshing,
  viewMode,
}: LeftPanelTabsProps) {
  const tabs: Array<{ key: LeftPanelTab; label: string; icon: typeof FileCode2 }> = [
    { key: 'jobs', label: '作业', icon: FileCode2 },
    { key: 'variables', label: '变量', icon: Braces },
  ];

  const modeButton = (
    <Tooltip
      side="right"
      content={viewMode === 'develop' ? '开发视图: 点击切换到运维视图 (Shift+V)' : '运维视图: 点击切换到开发视图 (Shift+V)'}
    >
      <button
        type="button"
        onClick={() => onModeChange(viewMode === 'develop' ? 'ops' : 'develop')}
        className={`flex h-11 w-11 items-center justify-center rounded-lg border transition ${
          viewMode === 'develop'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
        }`}
        aria-label={
          viewMode === 'develop'
            ? '当前开发视图，点击切换到运维视图，快捷键 Shift 加 V'
            : '当前运维视图，点击切换到开发视图，快捷键 Shift 加 V'
        }
      >
        {viewMode === 'develop' ? <Code2 className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
      </button>
    </Tooltip>
  );

  return (
    <div className="relative flex w-14 shrink-0 flex-col items-center border-r border-slate-200 bg-white py-2 shadow-[1px_0_0_rgba(15,23,42,0.03)]">
      <div className="flex w-full flex-col items-center gap-1">
        {modeButton}
        {viewMode === 'develop' && (
          <>
            <div className="my-1 h-px w-7 bg-slate-200" />
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <Tooltip key={tab.key} side="right" content={active ? (collapsed ? `展开${tab.label}` : `收起${tab.label}`) : tab.label}>
                  <button
                    type="button"
                    onClick={() => {
                      if (active) {
                        onToggle();
                        return;
                      }
                      onChange(tab.key);
                    }}
                    className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
                      active ? 'bg-primary/8 text-primary' : 'text-muted-foreground hover:bg-zinc-100 hover:text-foreground'
                    }`}
                    aria-label={active ? (collapsed ? `展开${tab.label}` : `收起${tab.label}`) : tab.label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                </Tooltip>
              );
            })}
          </>
        )}
        {viewMode === 'ops' && (
          <>
            <div className="my-1 h-px w-7 bg-slate-200" />
            <Tooltip side="right" content="刷新">
              <button
                type="button"
                onClick={onRefresh}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-zinc-100 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                disabled={refreshing}
                aria-label="刷新"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </Tooltip>
            <Tooltip side="right" content={opsSelectionMode ? '退出选择模式' : '选择模式'}>
              <button
                type="button"
                onClick={() => onOpsSelectionModeChange(!opsSelectionMode)}
                className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
                  opsSelectionMode ? 'bg-amber-100 text-amber-700' : 'text-muted-foreground hover:bg-zinc-100 hover:text-foreground'
                }`}
                aria-label={opsSelectionMode ? '退出选择模式' : '选择模式'}
              >
                <CheckSquare className="h-4 w-4" />
              </button>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}

export function RightPanelTabs({
  activeTab,
  onChange,
  onToggle,
}: RightPanelTabsProps) {
  const tabs: Array<{ key: RightPanelTab; label: string; icon: typeof FileCode2 }> = [
    { key: 'config', label: '配置', icon: Settings2 },
    { key: 'alerts', label: '告警', icon: Bell },
    { key: 'command', label: '命令', icon: TerminalSquare },
    { key: 'versions', label: '版本', icon: Tags },
    { key: 'savepoints', label: '快照', icon: Camera },
    { key: 'history', label: '执行', icon: History },
    { key: 'info', label: '信息', icon: Info },
  ];

  return (
    <div className="flex w-14 shrink-0 flex-col items-center border-l border-border/80 bg-white py-2">
      <div className="flex w-full flex-col items-center gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <Tooltip key={tab.key} side="left" content={tab.label}>
              <button
                type="button"
                onClick={() => {
                  if (active) {
                    onToggle();
                    return;
                  }
                  onChange(tab.key);
                }}
                className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
                  active ? 'bg-primary/8 text-primary' : 'text-muted-foreground hover:bg-zinc-100 hover:text-foreground'
                }`}
                aria-label={tab.label}
              >
                <Icon className="h-4 w-4" />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
