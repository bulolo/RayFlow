'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Building2,
  Calendar,
  ChevronRight,
  DatabaseZap,
  Gauge,
  LogOut,
  Network,
  PlayCircle,
  UserRound,
  Waypoints,
} from 'lucide-react';
import { useGetCurrentUser, useListMyTenants, useLogout } from '@/shared/api/generated';
import { getPlatformRoleLabel, isPlatformSuperAdmin } from '@/shared/auth/roles';
import { useAuthStore } from '@/stores/auth-store';
import { useTenantStore } from '@/stores/tenant-store';
import { useUIStore } from '@/stores/ui-store';
import { APP_NAME, APP_VERSION } from '@/lib/config/app';
import { cn } from '@/lib/utils';
import { Button, Tooltip } from '@/components/ui';

const navItems = [
  { label: '总览', path: '/', icon: Gauge },
  { label: '开发运维', path: '/development', icon: PlayCircle },
  { label: '任务调度', path: '/scheduler', icon: Calendar },
  { label: '资源中心', path: '/resource-center', icon: DatabaseZap },
  { label: '配置中心', path: '/config-center', icon: Building2 },
];

export function Header() {
  const [orgOpen, setOrgOpen] = useState(false);
  const pathname = usePathname();

  const setPlatformOpen = useUIStore((state) => state.setPlatformOpen);
  const { selectedOrg, setSelectedTenant, setTenantOptions, tenantOptions, hydrateTenantSelection } = useTenantStore();
  const { sessionHydrated, hydrateSession, user, token, clearSession, setSession } = useAuthStore();

  const currentUser = useGetCurrentUser({ query: { enabled: Boolean(token), retry: false } });
  const myTenants = useListMyTenants(undefined, { query: { enabled: sessionHydrated && Boolean(token), retry: false } });
  const logout = useLogout();

  useEffect(() => {
    hydrateSession();
    hydrateTenantSelection();
  }, [hydrateSession, hydrateTenantSelection]);

  useEffect(() => {
    if (currentUser.data && token) {
      setSession(token, currentUser.data);
    }
  }, [currentUser.data, setSession, token]);

  useEffect(() => {
    if (myTenants.data) {
      setTenantOptions(myTenants.data.list ?? []);
    }
  }, [myTenants.data, setTenantOptions]);

  const hasTenantAccess = tenantOptions.length > 0;

  const isSelected = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <header className="glass-header border-b border-border-subtle">
      <div className="flex h-16 items-center justify-between gap-4 px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
              <Waypoints className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-slate-900">{APP_NAME}</div>
              <div className="text-[10px] font-bold text-slate-400">数据开发治理平台</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const selected = isSelected(item.path);
              const className = cn(
                'flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors',
                selected
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
              );
              return (
                <Link key={item.path} href={item.path} className={className}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2.5">
          {hasTenantAccess ? (
            <div className="relative hidden md:block">
              <button
                onClick={() => setOrgOpen(!orgOpen)}
                className="flex items-center gap-2 rounded-lg border border-border-subtle bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/5 text-primary">
                  <Network className="h-3.5 w-3.5" />
                </div>
                <span>{selectedOrg}</span>
                <ChevronRight className="h-3 w-3 rotate-90 text-slate-400" />
              </button>

              {orgOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setOrgOpen(false)} />
                  <div className="absolute right-0 z-40 mt-2 w-48 rounded-lg border border-border-subtle bg-white p-1.5 shadow-[var(--shadow-card-hover)]">
                    {tenantOptions.map((tenant) => (
                      <button
                        key={tenant.id}
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setOrgOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-bold transition-colors',
                          selectedOrg === tenant.tenantName
                            ? 'bg-primary/10 text-primary'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        )}
                      >
                        {tenant.tenantName}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}
          <div className="hidden h-9 items-center rounded-lg border border-border-subtle bg-white px-3 text-xs font-bold text-slate-600 shadow-sm md:flex">
            v{APP_VERSION}
          </div>
          {isPlatformSuperAdmin(user) ? (
            <Button
              onClick={() => setPlatformOpen(true)}
              className="h-9 rounded-lg"
            >
              <Building2 className="h-4 w-4" />
              平台管理
            </Button>
          ) : null}
          {!sessionHydrated ? (
            <div className="h-9 w-[96px] rounded-lg border border-border-subtle bg-white shadow-sm" />
          ) : user ? (
            <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-white px-2 py-1.5 shadow-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/5 text-primary font-semibold text-sm">
                <UserRound className="h-4 w-4" />
              </div>
              <div className="hidden leading-tight md:block">
                <div className="text-xs font-bold text-slate-800">{user.nickname}</div>
                <div className="text-[10px] font-bold text-slate-400">{getPlatformRoleLabel(user)}</div>
              </div>
              <Tooltip content="退出登录" side="bottom">
                <button
                  className="ml-1 rounded-md p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                  onClick={() => {
                    logout.mutate(undefined, {
                      onSettled: () => {
                        clearSession();
                        window.location.href = '/login';
                      },
                    });
                  }}
                  aria-label="退出登录"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          ) : (
            <Button asChild variant="primary" className="h-9 rounded-lg px-4">
              <Link href="/login">
                <UserRound className="h-4 w-4" />
                登录
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
