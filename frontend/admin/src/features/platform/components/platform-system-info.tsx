'use client';

import type { ReactNode } from 'react';
import { Activity, CheckCircle2, Database, Layers3, RefreshCw, Server, Waypoints, XCircle, Zap } from 'lucide-react';
import { Button, SectionHeader } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  type SystemInfoConnectionStatus,
  type SystemInfoResourceTypeCount,
  useGetPlatformSystemInfo,
} from '@/shared/api/generated';

function statusText(ok?: boolean) {
  return ok ? '连接正常' : '连接失败';
}

function formatNumber(value?: number) {
  return String(value ?? 0);
}

function InfoRow({ label, mono, value }: { label: string; mono?: boolean; value?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/70 py-2 first:border-t-0">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className={cn('min-w-0 truncate text-right text-xs font-bold text-slate-800', mono && 'font-mono')} title={typeof value === 'string' ? value : undefined}>
        {value || '-'}
      </span>
    </div>
  );
}

function Metric({ label, value, tone = 'default' }: { label: string; value?: number; tone?: 'default' | 'danger' | 'success' }) {
  return (
    <div className={cn(
      'rounded-lg border bg-white/70 px-3 py-2',
      tone === 'danger' ? 'border-rose-200 text-rose-700' : tone === 'success' ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-700',
    )}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-black tabular-nums">{formatNumber(value)}</div>
    </div>
  );
}

function EngineCard({
  children,
  icon,
  iconBg,
  ping,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  iconBg: string;
  ping?: boolean;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconBg)}>
          {icon}
        </div>
        <h3 className="text-sm font-black text-slate-800">{title}</h3>
        {ping !== undefined ? (
          <span className={cn(
            'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
            ping ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
          )}>
            {ping ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {statusText(ping)}
          </span>
        ) : null}
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function ConnectionCard({
  connection,
  icon,
  iconBg,
  title,
}: {
  connection?: SystemInfoConnectionStatus;
  icon: ReactNode;
  iconBg: string;
  title: string;
}) {
  return (
    <EngineCard icon={icon} iconBg={iconBg} ping={connection?.ping} title={title}>
      <InfoRow label="后端" value={connection?.backend} />
      <InfoRow label="连接地址" value={connection?.connection || '-'} mono />
      <InfoRow label="状态说明" value={connection?.message || '-'} />
    </EngineCard>
  );
}

function ResourceBreakdown({ items }: { items?: SystemInfoResourceTypeCount[] }) {
  if (!items?.length) {
    return <p className="pt-2 text-xs font-medium text-slate-400">暂无资源类型统计</p>;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item.type} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
          {item.type}: {item.count ?? 0}
        </span>
      ))}
    </div>
  );
}

export function PlatformSystemInfo() {
  const systemInfo = useGetPlatformSystemInfo({ query: { staleTime: 30_000, retry: 1 } });
  const data = systemInfo.data;
  const refreshing = systemInfo.isFetching;

  return (
    <div className="max-w-5xl space-y-6">
      <SectionHeader
        title="系统信息"
        description="查看平台服务版本、数据库、Redis、Flyway 迁移和核心资源运行状态。"
        action={
          <Button variant="secondary" onClick={() => void systemInfo.refetch()} disabled={refreshing} className="h-9 px-4 text-xs font-bold">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            刷新
          </Button>
        }
      />

      {systemInfo.isLoading || !data ? (
        <div className="rounded-xl border border-border-subtle bg-white p-10 text-center text-sm font-semibold text-muted-foreground shadow-sm">
          系统信息加载中...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <EngineCard icon={<Waypoints className="h-4 w-4 text-slate-600" />} iconBg="bg-slate-100" title="系统">
              <div className="grid gap-x-6 md:grid-cols-2">
                <InfoRow label="应用" value={data.system?.app || 'RayFlow'} />
                <InfoRow label="版本" value={`v${data.system?.version || '-'}`} />
                <InfoRow label="运行环境" value={data.system?.environment || '-'} />
                <InfoRow label="时区" value={data.system?.timezone || '-'} />
                <InfoRow label="Java" value={data.system?.javaVersion || '-'} />
                <InfoRow label="前端状态" value="Admin 控制台已连接后端 SDK" />
              </div>
            </EngineCard>
          </div>

          <ConnectionCard
            connection={data.database}
            icon={<Database className="h-4 w-4 text-emerald-700" />}
            iconBg="bg-emerald-100"
            title="数据库"
          />

          <ConnectionCard
            connection={data.cache}
            icon={<Zap className="h-4 w-4 text-amber-700" />}
            iconBg="bg-amber-100"
            title="缓存"
          />

          <EngineCard icon={<Layers3 className="h-4 w-4 text-blue-700" />} iconBg="bg-blue-100" ping={data.migration?.success} title="数据库迁移">
            <InfoRow label="迁移工具" value="Flyway" />
            <InfoRow label="是否启用" value={data.migration?.enabled ? '已启用' : '未启用'} />
            <InfoRow label="当前版本" value={data.migration?.currentVersion || '-'} />
            <InfoRow label="当前描述" value={data.migration?.currentDescription || '-'} />
          </EngineCard>

          <EngineCard icon={<Server className="h-4 w-4 text-cyan-700" />} iconBg="bg-cyan-100" ping={(data.runtimes?.unreachable ?? 0) === 0} title="Flink 运行时">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="总数" value={data.runtimes?.total} />
              <Metric label="平台" value={data.runtimes?.platform} />
              <Metric label="租户" value={data.runtimes?.tenant} />
              <Metric label="运行中" value={data.runtimes?.running} tone="success" />
              <Metric label="不可达" value={data.runtimes?.unreachable} tone={(data.runtimes?.unreachable ?? 0) > 0 ? 'danger' : 'default'} />
              <Metric label="Gateway" value={data.runtimes?.gatewayRunning} />
            </div>
            <InfoRow label="内置 Flink" value={data.runtimes?.builtinFlinkVersion || '-'} />
          </EngineCard>

          <div className="md:col-span-2">
            <EngineCard icon={<Activity className="h-4 w-4 text-indigo-700" />} iconBg="bg-indigo-100" title="资源统计">
              <div className="grid gap-2 md:grid-cols-4">
                <Metric label="组织" value={data.resources?.tenants} />
                <Metric label="用户" value={data.resources?.users} />
                <Metric label="Flink 作业" value={data.resources?.flinkJobs} />
                <Metric label="调度工作流" value={data.resources?.schedulerWorkflows} />
                <Metric label="Paimon" value={data.resources?.paimonCatalogs} />
                <Metric label="StarRocks" value={data.resources?.starRocksConnections} />
                <Metric label="Fluss" value={data.resources?.flussClusters} />
              </div>
              <ResourceBreakdown items={data.resources?.lakeResources} />
            </EngineCard>
          </div>
        </div>
      )}
    </div>
  );
}
