'use client';

import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CircleDashed,
  Clock3,
  Play,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';
import {
  type FlinkRuntimeResponse,
  type FlinkJobResponse,
  useListFlinkRuntimes,
  useListFlinkJobs,
} from '@/shared/api/generated';
import { Badge, Button, Card } from '@/components/ui';
import { useAuthTokenState } from '@/hooks/use-auth-token-state';
import { getErrorMessage } from '@/lib/error-message';
import { statusTone } from '@/shared/ui/status-tone';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const overviewMetricSkeletons = Array.from({ length: 4 });
const overviewJobSkeletons = Array.from({ length: 5 });
const overviewRuntimeSkeletons = Array.from({ length: 4 });
const overviewStatusSkeletons = Array.from({ length: 4 });

function normalizeJobs(data: { list?: FlinkJobResponse[] } | undefined) {
  return data?.list ?? [];
}

function jobStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    CREATED: '已创建',
    PENDING: '等待中',
    RUNNING: '运行中',
    FINISHED: '已完成',
    FAILED: '失败',
    ERROR: '异常',
    CANCELED: '已取消',
    CANCELLED: '已取消',
    STOPPED: '已取消',
  };
  return status ? labels[status] ?? '未知状态' : '未知状态';
}

function runtimeStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    RUNNING: '正常',
    ACTIVE: '正常',
    UP: '正常',
    UNREACHABLE: '不可达',
    FAILED: '异常',
    ERROR: '异常',
    STOPPED: '已停止',
  };
  return status ? labels[status] ?? '未知状态' : '未知状态';
}

function gatewayStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    RUNNING: '网关正常',
    UNREACHABLE: '网关不可达',
    NOT_CONFIGURED: '未配置网关',
    STOPPED: '网关已停止',
  };
  return status ? labels[status] ?? '网关状态未知' : '未配置网关';
}

function jobTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    SQL: 'SQL 作业',
    JAR: 'JAR 作业',
    PYTHON: 'Python 作业',
  };
  return type ? labels[type] ?? '其他作业' : '未分类作业';
}

function submitTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    REST: 'REST 提交',
    SQL_GATEWAY: 'SQL Gateway',
    RUNNER: 'Runner 提交',
  };
  return type ? labels[type] ?? '其他提交' : '未配置提交';
}

export function OverviewDashboard() {
  const hasToken = useAuthTokenState();

  const clusters = useListFlinkRuntimes(undefined, { query: { enabled: hasToken } });
  const jobs = useListFlinkJobs({ is_pager: 0, page: 1, size: 100 }, { query: { enabled: hasToken } });

  const jobRows = hasToken ? normalizeJobs(jobs.data) : [];
  const clusterRows = clusters.data?.list ?? [];
  const currentJobs = jobRows;

  const isLoading = hasToken && (clusters.isLoading || jobs.isLoading);
  const loadError = clusters.error || jobs.error;

  const runningJobs = currentJobs.filter((job) => job.status === 'RUNNING');
  const failedJobs = currentJobs.filter((job) => ['FAILED', 'ERROR'].includes(job.status ?? ''));
  const createdJobs = currentJobs.filter((job) => job.status === 'CREATED');
  const terminalJobs = currentJobs.filter((job) => ['CANCELED', 'CANCELLED', 'FINISHED', 'STOPPED'].includes(job.status ?? ''));
  const healthyClusters = clusterRows.filter((cluster) => ['RUNNING', 'ACTIVE', 'UP'].includes(cluster.status ?? ''));
  const reachableGateways = clusterRows.filter((cluster) => cluster.gatewayStatus === 'RUNNING');
  const recentJobs = [...currentJobs]
    .sort((left, right) => new Date(right.updatedAt ?? right.createdAt ?? '').getTime() - new Date(left.updatedAt ?? left.createdAt ?? '').getTime())
    .slice(0, 5);
  const focusJobs = (failedJobs.length ? failedJobs : runningJobs.length ? runningJobs : recentJobs).slice(0, 5);

  if (isLoading) {
    return <OverviewLoading />;
  }

  return (
    <div className="space-y-4">
      {loadError ? (
        <Card className="flex items-center justify-between gap-4 border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-amber-900">总览数据加载不完整</div>
              <div className="mt-1 truncate text-xs font-medium text-amber-700">
                {getErrorMessage(loadError, '后端服务暂不可用，请稍后重试')}
              </div>
            </div>
          </div>
          <Button className="h-8 shrink-0 rounded-lg text-xs" onClick={() => void Promise.all([clusters.refetch(), jobs.refetch()])}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Activity} label="作业总数" value={currentJobs.length} sub="当前纳管 Flink 作业" />
        <MetricCard icon={Play} label="运行中" value={runningJobs.length} sub="正在运行时执行" tone="success" />
        <MetricCard icon={AlertTriangle} label="异常作业" value={failedJobs.length} sub="需要优先处理" tone={failedJobs.length ? 'danger' : 'neutral'} />
        <MetricCard icon={ShieldCheck} label="SQL Gateway" value={`${reachableGateways.length}/${clusterRows.length}`} sub="可用于 SQL 提交与预览" tone="success" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <SectionTitle
            action={(
              <Button asChild variant="primary" className="h-8 rounded-lg px-3 text-xs font-bold">
                <Link href="/development">
                  <Plus className="h-3.5 w-3.5" />
                  新建作业
                </Link>
              </Button>
            )}
            description="异常、运行中和最近更新"
            title="重点作业"
          />
          <div className="divide-y divide-border-subtle">
            {focusJobs.map((job) => (
              <JobRow key={job.id ?? job.jobName} job={job} />
            ))}
            {!focusJobs.length ? (
              <EmptyState icon={CircleDashed} title="暂无作业" description="创建第一个 Flink 作业后，这里会展示运行状态和最近更新。" />
            ) : null}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <SectionTitle
              action={<Badge tone={healthyClusters.length === clusterRows.length && clusterRows.length ? 'success' : 'warning'}>{healthyClusters.length}/{clusterRows.length}</Badge>}
              description="提交目标与网关可用性"
              title="运行时状态"
            />
            <div className="divide-y divide-border-subtle">
              {clusterRows.slice(0, 4).map((cluster) => (
                <RuntimeRow key={cluster.id ?? cluster.clusterName} runtime={cluster} />
              ))}
              {!clusterRows.length ? (
                <EmptyState icon={Server} title="暂无运行时配置" description="添加 Flink 运行时后，作业才能提交运行。" />
              ) : null}
            </div>
          </Card>

          <Card className="p-5 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-foreground">运行分布</div>
                <div className="mt-0.5 text-xs text-muted-foreground">按当前作业状态统计</div>
              </div>
              <Badge tone="neutral">{currentJobs.length} 个作业</Badge>
            </div>
            <div className="mt-4 space-y-3">
              <StatusLine label="运行中" value={runningJobs.length} total={currentJobs.length} tone="bg-emerald-500" />
              <StatusLine label="异常" value={failedJobs.length} total={currentJobs.length} tone="bg-rose-500" />
              <StatusLine label="已创建" value={createdJobs.length} total={currentJobs.length} tone="bg-amber-500" />
              <StatusLine label="已取消/完成" value={terminalJobs.length} total={currentJobs.length} tone="bg-slate-400" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  action,
  description,
  title,
}: {
  action?: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border-subtle px-5 py-3">
      <div className="min-w-0">
        <div className="text-sm font-bold text-foreground">{title}</div>
        {description ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{description}</div> : null}
      </div>
      {action}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  sub,
  tone = 'neutral',
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  tone?: 'neutral' | 'success' | 'danger' | 'info' | 'warning';
  value: number | string;
}) {
  const styles = {
    neutral: 'bg-zinc-50 text-muted-foreground border-border',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <Card className="p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</div>
          <div className="mt-1.5 truncate text-[11px] font-medium text-muted-foreground">{sub}</div>
        </div>
        <div className={`shrink-0 rounded-lg border p-2 ${styles[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function JobRow({ job }: { job: FlinkJobResponse }) {
  const isRunning = job.status === 'RUNNING';

  return (
    <Link href="/development" className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/5 text-primary">
          {isRunning ? <Activity className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-foreground">{job.jobName || '未命名作业'}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            <span>{jobTypeLabel(job.jobType)}</span>
            <span className="text-slate-300 select-none">·</span>
            <span>并行度 {job.parallelism ?? 1}</span>
            <span className="text-slate-300 select-none">·</span>
            <span>{submitTypeLabel(job.submitType)}</span>
          </div>
        </div>
      </div>
      <Badge tone={statusTone(job.status)} className="font-semibold">{jobStatusLabel(job.status)}</Badge>
    </Link>
  );
}

function RuntimeRow({ runtime }: { runtime: FlinkRuntimeResponse }) {
  const gatewayTone: BadgeTone =
    runtime.gatewayStatus === 'RUNNING'
      ? 'success'
      : runtime.gatewayStatus === 'UNREACHABLE'
        ? 'danger'
        : 'neutral';

  return (
    <div className="px-5 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-bold text-foreground">{runtime.clusterName || '未命名运行时'}</div>
            {runtime.clusterScope === 'PLATFORM' ? (
              <span className="inline-flex shrink-0 items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                平台共享
              </span>
            ) : null}
          </div>
          <div className="mt-1 truncate text-xs font-medium text-muted-foreground">{runtime.address || runtime.clusterType || '暂无地址'}</div>
        </div>
        <Badge tone={statusTone(runtime.status)} className="font-semibold">{runtimeStatusLabel(runtime.status)}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={gatewayTone} className="font-semibold">{gatewayStatusLabel(runtime.gatewayStatus)}</Badge>
        {runtime.flinkVersion ? <span className="text-xs font-semibold text-muted-foreground">Flink {runtime.flinkVersion}</span> : null}
      </div>
    </div>
  );
}

function StatusLine({
  label,
  tone,
  total,
  value,
}: {
  label: string;
  tone: string;
  total: number;
  value: number;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold text-slate-700">
          {value} <span className="text-[10px] text-muted-foreground font-normal">({percent}%)</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function EmptyState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-6">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-bold text-foreground">{title}</div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

function OverviewLoading() {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewMetricSkeletons.map((_, index) => (
          <Card key={index} className="p-4 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                <div className="mt-3 h-8 w-14 animate-pulse rounded bg-slate-200" />
                <div className="mt-3.5 h-3 w-32 max-w-full animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg border border-slate-100 bg-slate-50" />
            </div>
          </Card>
        ))}
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border-subtle px-5 py-3">
            <div className="min-w-0">
              <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-36 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
          </div>
          <div className="divide-y divide-border-subtle">
            {overviewJobSkeletons.map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                  <div className="min-w-0 flex-1">
                    <div className="h-4 animate-pulse rounded bg-slate-200" style={{ width: `${index % 2 === 0 ? 46 : 62}%` }} />
                    <div className="mt-2 flex gap-2">
                      <div className="h-3 w-14 animate-pulse rounded bg-slate-100" />
                      <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                      <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                </div>
                <div className="h-6 w-16 shrink-0 animate-pulse rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border-subtle px-5 py-3">
              <div className="min-w-0">
                <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-6 w-12 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="divide-y divide-border-subtle">
              {overviewRuntimeSkeletons.map((_, index) => (
                <div key={index} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="h-4 animate-pulse rounded bg-slate-200" style={{ width: `${index % 2 === 0 ? 64 : 48}%` }} />
                      <div className="mt-2 h-3 w-40 max-w-full animate-pulse rounded bg-slate-100" />
                    </div>
                    <div className="h-6 w-14 shrink-0 animate-pulse rounded-full bg-slate-100" />
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
                    <div className="h-3 w-16 self-center animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="mt-4 space-y-3">
              {overviewStatusSkeletons.map((_, index) => (
                <div key={index}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="h-3 w-14 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-6 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full animate-pulse rounded-full bg-slate-200" style={{ width: `${index === 0 ? 58 : index === 1 ? 24 : index === 2 ? 42 : 72}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
