'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SettingsTab<T extends string> {
  key: T;
  label: string;
  description: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SettingsShellProps<T extends string> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  headerIcon?: ReactNode;
  headerIconWrapperClassName?: string;
  activeTab: T;
  onActiveTabChange: (tab: T) => void;
  tabs: Array<SettingsTab<T>>;
  children: ReactNode;
  mode?: 'modal' | 'page';
}

export function SettingsShell<T extends string>({
  open,
  onOpenChange,
  title,
  headerIcon,
  headerIconWrapperClassName,
  activeTab,
  onActiveTabChange,
  tabs,
  children,
  mode = 'modal',
}: SettingsShellProps<T>) {
  if (mode === 'modal' && !open) return null;

  const pageMode = mode === 'page';

  const content = (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden bg-white',
        pageMode ? 'border border-border/50' : 'rounded-2xl border border-border/60',
      )}
    >
      {!pageMode ? (
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-white px-5">
          <div className="flex items-center gap-2.5">
            <div className={cn('rounded-lg bg-zinc-50 p-1.5', headerIconWrapperClassName)}>
              {headerIcon}
            </div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
          </div>

          <button
            aria-label={`关闭${title}`}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={() => onOpenChange?.(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <div
          className={cn(
            'hidden shrink-0 flex-col border-r border-border-subtle p-3 md:flex',
            pageMode ? 'w-60 bg-slate-50/80' : 'w-56 bg-muted/60',
          )}
        >
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.key;
            const showGroup = index === 0 || tab.group !== tabs[index - 1].group;
            return (
              <div key={tab.key}>
                {showGroup ? (
                  <div className="px-3 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {tab.group}
                  </div>
                ) : null}
                <button
                  className={cn(
                    'my-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all',
                    selected
                      ? 'bg-white text-primary shadow-sm ring-1 ring-border'
                      : 'text-muted-foreground hover:bg-white hover:text-foreground',
                  )}
                  onClick={() => onActiveTabChange(tab.key)}
                >
                  <Icon className={cn('h-4 w-4 opacity-70', selected ? 'text-primary opacity-100' : undefined)} />
                  {tab.label}
                </button>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 flex gap-2 overflow-x-auto border-b border-border-subtle px-6 py-3.5 md:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={cn(
                'h-8 shrink-0 rounded-lg border px-3 text-xs font-bold transition-colors',
                activeTab === tab.key ? 'border-primary/20 bg-primary/10 text-primary shadow-sm' : 'border-transparent text-slate-500 hover:bg-slate-50',
              )}
              onClick={() => onActiveTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-white">
          <div className={cn('w-full py-6', pageMode ? 'max-w-none px-6 lg:px-8' : 'max-w-5xl p-8')}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  if (mode === 'page') return content;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[4px]"><div className="h-[85vh] min-h-[560px] w-[1200px] max-w-[95vw]">{content}</div></div>;
}
