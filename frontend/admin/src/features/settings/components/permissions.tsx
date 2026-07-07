'use client';

import { Info, Lock, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, SectionHeader } from '@/components/ui';
import {
  buildPermissionDefaults,
  PERMISSION_GROUPS,
  PERMISSION_ROLES,
  type PermissionCap,
  type PermissionRole,
} from '@/features/settings/config';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function Permissions() {
  const [activeGroupLabel, setActiveGroupLabel] = useState(PERMISSION_GROUPS[0].label);
  const [grants, setGrants] = useState<Set<string>>(() => buildPermissionDefaults(PERMISSION_GROUPS));
  const defaults = useMemo(() => buildPermissionDefaults(PERMISSION_GROUPS), []);

  const activeGroup = useMemo(
    () => PERMISSION_GROUPS.find((group) => group.label === activeGroupLabel) ?? PERMISSION_GROUPS[0],
    [activeGroupLabel],
  );

  const isDirty = useMemo(() => {
    if (grants.size !== defaults.size) return true;
    for (const key of grants) {
      if (!defaults.has(key)) return true;
    }
    return false;
  }, [defaults, grants]);

  const hasPermission = (capKey: string, roleKey: PermissionRole['key']) => grants.has(`${capKey}|${roleKey}`);
  const isLocked = (cap: PermissionCap, role: PermissionRole) => Boolean(role.locked || cap.baseline);

  function togglePermission(cap: PermissionCap, role: PermissionRole) {
    if (isLocked(cap, role)) return;
    setGrants((current) => {
      const next = new Set(current);
      const key = `${cap.key}|${role.key}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function restoreDefaults() {
    setGrants(buildPermissionDefaults(PERMISSION_GROUPS));
    toast.success('已恢复默认权限矩阵');
  }

  function savePermissions() {
    toast.success('权限矩阵已保存到前端演示状态');
  }

  return (
    <div className="w-full space-y-6">
      <SectionHeader
        action={
          <>
            <Button className="h-9 gap-1.5 px-3 text-xs font-bold" onClick={restoreDefaults}>
              <RotateCcw className="h-3.5 w-3.5" />
              恢复默认
            </Button>
            <Button className="h-9 px-4 text-xs font-bold shadow-sm" disabled={!isDirty} onClick={savePermissions} variant="primary">
              保存更改
            </Button>
          </>
        }
        description="参考 OwlApi 的权限矩阵样式，按栏目维护租户级角色的查看与管理能力。"
        title="权限管理"
      />

      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" />
        <p className="leading-5">
          <span className="font-bold text-foreground">管理员</span> 默认拥有全部权限且不可取消
          <Lock className="mx-1 inline h-3 w-3 -translate-y-px" />。
          各模块的查看权限为基础能力，成员默认可见。平台管理仍由超级管理员单独控制，不在当前租户矩阵内编辑。
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <div className="border-r border-border-subtle pr-4">
          {PERMISSION_GROUPS.map((group, index) => {
            const Icon = group.icon;
            const prevSection = index > 0 ? PERMISSION_GROUPS[index - 1].section : undefined;
            const showSectionHeader = index === 0 || prevSection !== group.section;
            const active = group.label === activeGroupLabel;

            return (
              <div key={group.label}>
                {showSectionHeader ? (
                  <div className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    {group.section}
                  </div>
                ) : null}
                <button
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-bold transition-all',
                    active ? 'border-primary/20 bg-primary/5 text-primary shadow-sm' : 'border-transparent text-muted-foreground hover:bg-zinc-50 hover:text-foreground',
                  )}
                  onClick={() => setActiveGroupLabel(group.label)}
                  type="button"
                >
                  <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="truncate">{group.label}</span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="min-w-0 flex-1">
          <section className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-card">
            <div
              className="grid items-end gap-0 border-b border-border-subtle bg-zinc-50/60 px-5 py-3"
              style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${PERMISSION_ROLES.length}, 136px)` }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {activeGroup.label} 模块 / 操作
              </span>
              {PERMISSION_ROLES.map((role) => (
                <div key={role.key} className="px-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs font-bold text-foreground">{role.label}</span>
                    {role.locked ? <Lock className="h-3 w-3 text-muted-foreground" /> : null}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">{role.hint}</span>
                </div>
              ))}
            </div>

            <div className="divide-y divide-border-subtle/50">
              {activeGroup.caps.map((cap) => (
                <div
                  key={cap.key}
                  className="grid items-center gap-0 px-5 py-3.5 transition-colors hover:bg-zinc-50/40"
                  style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${PERMISSION_ROLES.length}, 136px)` }}
                >
                  <div className="min-w-0 pr-4">
                    <p className="truncate text-sm font-semibold text-foreground">{cap.label}</p>
                    {cap.desc ? <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{cap.desc}</p> : null}
                  </div>

                  {PERMISSION_ROLES.map((role) => {
                    const locked = isLocked(cap, role);
                    const checked = role.locked ? true : hasPermission(cap.key, role.key);
                    return (
                      <div key={`${cap.key}-${role.key}`} className="flex justify-center">
                        <label
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded border transition-colors',
                            checked ? 'border-primary/25 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-transparent',
                            locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-primary/30 hover:bg-primary/5',
                          )}
                        >
                          <input
                            checked={checked}
                            className="sr-only"
                            disabled={locked}
                            onChange={() => togglePermission(cap, role)}
                            type="checkbox"
                          />
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
                            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                          </svg>
                        </label>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
            当前版本仍以角色档位为后端真实门控，这里先把权限管理前端做成 OwlApi 同类矩阵界面，用于统一系统设置的设计语言与后续 RBAC 演进。
          </p>
        </div>
      </div>
    </div>
  );
}
