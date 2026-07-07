'use client';

import { useMemo, useState } from 'react';
import { Activity, BookOpen, Camera, Check, CheckSquare, ChevronDown, ExternalLink, Layers3, Loader2, Pencil, Play, Rocket, Search, Square, Trash2, X } from 'lucide-react';
import {
  type FlinkJobResponse,
  useListNotificationChannels,
} from '@/shared/api/generated';
import { TableEmpty, TablePagination, TableShell } from '@/components/data-display/table-shell';
import { useAuthTokenState } from '@/hooks/use-auth-token-state';
import { Badge, Button, Tooltip } from '@/components/ui';
import { getFlinkUiUrl } from '@/features/development/lib/flink-ui';
import type { ExtendedFlinkJob } from '@/types/extended';

export type OpsColumnFilterOption = {
  key: string;
  label: string;
};

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

function jobStatusTone(status?: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'RUNNING') return 'success';
  if (status === 'FINISHED') return 'info';
  if (status === 'CREATED' || status === 'PENDING') return 'warning';
  if (status === 'FAILED' || status === 'ERROR') return 'danger';
  if (status === 'CANCELED' || status === 'CANCELLED' || status === 'STOPPED') return 'neutral';
  return 'neutral';
}

function isActiveJobStatus(status?: string) {
  return status === 'SUBMITTING' || status === 'RUNNING';
}

function jobTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    SQL: 'SQL',
    JAR: 'JAR',
    PYTHON: 'Python',
  };
  return type ? labels[type] ?? '其他' : '未分类';
}

function submitTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    REST: 'REST',
    SQL_GATEWAY: 'SQL Gateway',
    RUNNER: 'Runner',
  };
  return type ? labels[type] ?? '其他' : '未配置';
}

function RuntimeModeBadge({ jobType, mode }: { jobType?: string; mode?: string }) {
  if (jobType !== 'SQL') {
    return <span className="text-xs font-semibold text-slate-400">-</span>;
  }
  const isBatch = mode === 'BATCH';
  const Icon = isBatch ? Layers3 : Activity;
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold',
        isBatch
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-sky-200 bg-sky-50 text-sky-700',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" />
      {isBatch ? '批' : '流'}
    </span>
  );
}

function splitJobTags(tags?: string) {
  return (tags ?? '')
    .split(/[,\s，]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function JobTags({ tags }: { tags?: string }) {
  const items = splitJobTags(tags);
  if (!items.length) {
    return <span className="text-xs font-semibold text-slate-400">-</span>;
  }
  const visible = items.slice(0, 3);
  const hiddenCount = Math.max(0, items.length - visible.length);
  return (
    <Tooltip content={items.join(' / ')}>
      <div className="flex min-w-0 items-center gap-1.5">
        {visible.map((tag) => (
          <span key={tag} className="inline-flex max-w-[88px] truncate rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            {tag}
          </span>
        ))}
        {hiddenCount ? (
          <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            +{hiddenCount}
          </span>
        ) : null}
      </div>
    </Tooltip>
  );
}

function actionButtonClass(enabled: boolean, tone: 'blue' | 'green' | 'red' | 'slate' | 'violet') {
  if (!enabled) {
    return 'h-7 w-7 border border-slate-200 bg-slate-50 p-0 text-slate-300';
  }
  const styles = {
    blue: 'border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700',
    green: 'border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700',
    red: 'border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700',
    slate: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    violet: 'border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 hover:text-violet-700',
  } as const;
  return `h-7 w-7 p-0 ${styles[tone]}`;
}

function actionTooltip(base: string, enabled: boolean, reason: string) {
  return enabled ? base : `${base}不可用：${reason}`;
}

function publishActionTooltip(status: string | undefined, enabled: boolean, reason: string) {
  if (!enabled) return `发布不可用：${reason}`;
  if (status === 'OUTDATED') return '发布当前保存定义：存在未发布的新版本';
  if (status === 'UNPUBLISHED') return '发布当前保存定义：当前作业还没有发布版本';
  return '发布当前保存定义';
}

function ColumnFilterHeader({
  activeValue,
  label,
  onChange,
  options,
}: {
  activeValue: string;
  label: string;
  onChange: (value: string) => void;
  options: OpsColumnFilterOption[];
}) {
  const [open, setOpen] = useState(false);
  const activeOption = options.find((option) => option.key === activeValue);
  const filtered = activeValue !== 'all';

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition ${
          filtered ? 'bg-primary/8 text-primary' : 'text-slate-500 hover:bg-white hover:text-slate-800'
        }`}
        aria-expanded={open}
        aria-label={`${label}筛选，当前${activeOption?.label ?? '全部'}`}
      >
        <span>{label}</span>
        {filtered ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px]">{activeOption?.label}</span> : null}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute left-0 top-8 z-30 w-36 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          {options.map((option) => {
            const active = option.key === activeValue;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  onChange(option.key);
                  setOpen(false);
                }}
                className={`flex h-8 w-full items-center justify-between rounded-md px-2 text-xs font-semibold transition ${
                  active ? 'bg-primary/8 text-primary' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{option.label}</span>
                {active ? <Check className="h-3.5 w-3.5" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function JobOpsView({
  clusterNameById,
  clusterAddressById,
  jobs,
  jobNameKeyword,
  loading,
  operatingJobIds,
  onBatchCancel,
  onBatchRun,
  onBatchSavepoint,
  onCancel,
  onDelete,
  onEdit,
  onJobNameKeywordChange,
  onPageChange,
  onPageSizeChange,
  onPublish,
  onRun,
  onRuntimeModeFilterChange,
  onSavepoint,
  onStatusFilterChange,
  onTagKeywordChange,
  page,
  pageCount,
  pageSize,
  selectionMode,
  selectedJobIds,
  selectedJobId,
  selectedJobs,
  onSelectedJobIdsChange,
  onSelectionModeChange,
  runtimeModeFilterOptions,
  runtimeModeFilterValue,
  onTypeFilterChange,
  statusFilterOptions,
  statusFilterValue,
  tagKeyword,
  totalJobs,
  typeFilterOptions,
  typeFilterValue,
}: {
  clusterNameById: Map<number | undefined, string | undefined>;
  clusterAddressById: Map<number | undefined, string | undefined>;
  jobs: ExtendedFlinkJob[];
  jobNameKeyword: string;
  loading: boolean;
  operatingJobIds: Record<number, 'run' | 'debug' | 'publish' | 'cancel' | 'savepoint' | 'delete' | boolean>;
  onBatchCancel: (jobs: ExtendedFlinkJob[]) => void;
  onBatchRun: (jobs: ExtendedFlinkJob[]) => void;
  onBatchSavepoint: (jobs: ExtendedFlinkJob[]) => void;
  onCancel: (job: FlinkJobResponse) => void;
  onDelete: (job: FlinkJobResponse) => void;
  onEdit: (job: FlinkJobResponse) => void;
  onJobNameKeywordChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onPublish: (job: FlinkJobResponse) => void;
  onRun: (job: FlinkJobResponse) => void;
  onRuntimeModeFilterChange: (value: string) => void;
  onSavepoint: (job: FlinkJobResponse) => void;
  onStatusFilterChange: (value: string) => void;
  onTagKeywordChange: (value: string) => void;
  page: number;
  pageCount: number;
  pageSize: number;
  selectionMode: boolean;
  selectedJobIds: number[];
  selectedJobId?: number;
  selectedJobs: ExtendedFlinkJob[];
  onSelectedJobIdsChange: (ids: number[]) => void;
  onSelectionModeChange: (enabled: boolean) => void;
  runtimeModeFilterOptions: OpsColumnFilterOption[];
  runtimeModeFilterValue: string;
  onTypeFilterChange: (value: string) => void;
  statusFilterOptions: OpsColumnFilterOption[];
  statusFilterValue: string;
  tagKeyword: string;
  totalJobs: number;
  typeFilterOptions: OpsColumnFilterOption[];
  typeFilterValue: string;
}) {
  const hasToken = useAuthTokenState();
  const channels = useListNotificationChannels({ is_pager: 0 }, { query: { enabled: hasToken } });
  const channelMap = useMemo(() => {
    const map = new Map<number, string>();
    (channels.data?.list ?? []).forEach((channel) => {
      if (channel.id) {
        map.set(channel.id, channel.name ?? '');
      }
    });
    return map;
  }, [channels.data?.list]);
  const selectableIds = jobs.map((job) => job.id).filter((id): id is number => Boolean(id));
  const allCurrentPageSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedJobIds.includes(id));
  const selectedRunningJobs = selectedJobs.filter((job) => job.status === 'RUNNING');
  const selectedRunnableJobs = selectedJobs.filter((job) => job.status !== 'RUNNING' && job.publishStatus === 'PUBLISHED');

  function toggleAllCurrentPage(checked: boolean) {
    if (checked) {
      onSelectedJobIdsChange(Array.from(new Set([...selectedJobIds, ...selectableIds])));
      return;
    }
    onSelectedJobIdsChange(selectedJobIds.filter((id) => !selectableIds.includes(id)));
  }

  function toggleJob(id: number, checked: boolean) {
    if (checked) {
      onSelectedJobIdsChange(Array.from(new Set([...selectedJobIds, id])));
      return;
    }
    onSelectedJobIdsChange(selectedJobIds.filter((selectedId) => selectedId !== id));
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col bg-zinc-50/60">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div>
          <div className="text-sm font-bold text-slate-900">作业运维列表</div>
          <div className="text-xs font-medium text-slate-400">面向巡检、发布、运行发布版本、保存点和快速编辑</div>
        </div>
      </div>
      <div className={`min-h-0 flex-1 overflow-auto p-4 ${selectionMode ? 'pb-24' : ''}`}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={jobNameKeyword}
              onChange={(event) => onJobNameKeywordChange(event.target.value)}
              placeholder="搜索作业名称"
              className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm placeholder-slate-400 outline-none transition duration-150 focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <label className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={tagKeyword}
              onChange={(event) => onTagKeywordChange(event.target.value)}
              placeholder="搜索标签"
              className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm placeholder-slate-400 outline-none transition duration-150 focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
        </div>
        <TableShell>
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
            <thead className="border-b border-border-subtle bg-slate-50/70 text-xs font-semibold text-slate-500">
              <tr>
                {selectionMode ? (
                  <th className="w-10 px-5 py-3">
                    <input
                      aria-label="选择当前页作业"
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                      checked={allCurrentPageSelected}
                      disabled={!selectableIds.length}
                      onChange={(event) => toggleAllCurrentPage(event.target.checked)}
                    />
                  </th>
                ) : null}
                <th className="px-5 py-3 font-semibold">作业名称</th>
                <th className="px-5 py-3 font-semibold">
                  <ColumnFilterHeader
                    activeValue={runtimeModeFilterValue}
                    label="模式"
                    onChange={onRuntimeModeFilterChange}
                    options={runtimeModeFilterOptions}
                  />
                </th>
                <th className="px-5 py-3 font-semibold">
                  <ColumnFilterHeader
                    activeValue={typeFilterValue}
                    label="类型"
                    onChange={onTypeFilterChange}
                    options={typeFilterOptions}
                  />
                </th>
                <th className="px-5 py-3 font-semibold">标签</th>
                <th className="px-5 py-3 font-semibold">运行时</th>
                <th className="px-5 py-3 font-semibold">并行度</th>
                <th className="px-5 py-3 font-semibold">提交方式</th>
                <th className="px-5 py-3 font-semibold">告警</th>
                <th className="px-5 py-3 font-semibold">
                  <ColumnFilterHeader
                    activeValue={statusFilterValue}
                    label="状态"
                    onChange={onStatusFilterChange}
                    options={statusFilterOptions}
                  />
                </th>
                <th className="px-5 py-3 font-semibold">Flink UI</th>
                <th className="px-5 py-3 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-white">
              {jobs.map((job) => {
                const jobId = job.id;
                const isRunningJob = job.status === 'RUNNING';
                const isSelected = jobId === selectedJobId;
                const isOperating = jobId ? Boolean(operatingJobIds[jobId]) : false;
                const currentOperation = jobId ? operatingJobIds[jobId] : undefined;
                const canPublish = !loading && !isRunningJob && !isOperating;
                const canRun = !loading && !isRunningJob && !isOperating && job.publishStatus === 'PUBLISHED';
                const canStop = !loading && isRunningJob && !isOperating;
                const canSavepoint = !loading && isRunningJob && !isOperating;
                const canEdit = !isOperating;
                const canDelete = !loading && !isRunningJob && !isOperating;
                const runDisabledReason = isRunningJob ? '作业正在运行' : job.publishStatus !== 'PUBLISHED' ? '请先发布版本' : '当前正在处理其他操作';
                const publishNeedsAttention = job.publishStatus !== 'PUBLISHED';
                return (
                  <tr key={jobId ?? job.jobName} className={isSelected ? 'bg-primary/5' : 'transition-colors hover:bg-slate-50/50'}>
                    {selectionMode ? (
                      <td className="px-5 py-3">
                        {jobId ? (
                          <input
                            aria-label={`选择作业 ${job.jobName ?? jobId}`}
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                            checked={selectedJobIds.includes(jobId)}
                            onChange={(event) => toggleJob(jobId, event.target.checked)}
                          />
                        ) : null}
                      </td>
                    ) : null}
                    <td className="max-w-[260px] px-5 py-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Tooltip content={job.jobName || '未命名作业'}>
                          <button
                            type="button"
                            onClick={() => onEdit(job)}
                            className="block truncate text-left text-sm font-bold text-slate-900 hover:text-primary flex-1 min-w-0"
                            aria-label={job.jobName || '未命名作业'}
                          >
                            {job.jobName || '未命名作业'}
                          </button>
                        </Tooltip>
                        {job.docUrl ? (
                          <Tooltip content="查看文档">
                            <a
                              href={job.docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-primary/20 bg-primary/5 text-primary transition hover:bg-primary/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <BookOpen className="h-3 w-3" />
                            </a>
                          </Tooltip>
                        ) : null}
                      </div>
                      {job.description ? (
                        <Tooltip content={job.description}>
                          <div className="mt-0.5 truncate text-xs font-medium text-slate-400">{job.description}</div>
                        </Tooltip>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <RuntimeModeBadge jobType={job.jobType} mode={job.runtimeMode} />
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold text-slate-600">{jobTypeLabel(job.jobType)}</td>
                    <td className="max-w-[220px] px-5 py-3">
                      <JobTags tags={job.jobTags} />
                    </td>
                    <td className="max-w-[180px] px-5 py-3 text-xs font-semibold text-slate-500">
                      <Tooltip content={job.clusterId ? clusterNameById.get(job.clusterId) || `运行时 ${job.clusterId}` : '未绑定'}>
                        <div className="truncate">
                          {job.clusterId ? clusterNameById.get(job.clusterId) || `运行时 ${job.clusterId}` : '未绑定'}
                        </div>
                      </Tooltip>
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold text-slate-500">{job.parallelism ?? 1}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-slate-500">{submitTypeLabel(job.submitType)}</td>
                    <td className="max-w-[150px] px-5 py-3 text-xs">
                      {job.alertChannelId ? (
                        <div className="truncate font-semibold text-slate-600">
                          {channelMap.get(job.alertChannelId) || '已启用'}
                          <span className="ml-1 text-[10px] font-bold text-muted-foreground">
                            ({(job.alertRule || 'FAILED').split(',').map(r => {
                              const ruleLabels: Record<string, string> = { FAILED: '失败', CANCELED: '取消', FINISHED: '完成' };
                              return ruleLabels[r.trim()] || r.trim();
                            }).join('/')})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium">未配置</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</Badge>
                    </td>
                    {(() => {
                      const address = job.clusterId ? clusterAddressById.get(job.clusterId) : undefined;
                      const showCurrentFlinkJobId = isActiveJobStatus(job.status) && Boolean(job.flinkJobId);
                      if (showCurrentFlinkJobId && job.flinkJobId && address) {
                        return (
                          <td className="px-5 py-3">
                            <Tooltip content={`打开 Flink UI · ${job.flinkJobId}`}>
                              <a
                                href={getFlinkUiUrl(address, job)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 text-xs font-bold text-primary transition hover:bg-primary/10"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                打开
                              </a>
                            </Tooltip>
                          </td>
                        );
                      }
                      return (
                        <td className="px-5 py-3 text-xs text-slate-400">
                          <Tooltip content={job.flinkJobId && !showCurrentFlinkJobId ? '作业已结束，历史 Flink Job ID 请查看执行记录' : '当前没有运行中的 Flink Job'}>
                            <div className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 font-semibold">-</div>
                          </Tooltip>
                        </td>
                      );
                    })()}
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Tooltip content={publishActionTooltip(job.publishStatus, canPublish, isRunningJob ? '作业正在运行' : '当前正在处理其他操作')}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`${actionButtonClass(canPublish, publishNeedsAttention ? 'violet' : 'slate')} relative`}
                            disabled={!canPublish}
                            aria-label="发布"
                            onClick={() => onPublish(job)}
                          >
                            {publishNeedsAttention && canPublish ? (
                              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                            ) : null}
                            {currentOperation === 'publish' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Rocket className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </Tooltip>
                        <Tooltip content={actionTooltip('运行发布版本', canRun, runDisabledReason)}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={actionButtonClass(canRun, 'green')}
                            disabled={!canRun}
                            aria-label="运行发布版本"
                            onClick={() => onRun(job)}
                          >
                            {currentOperation === 'run' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </Tooltip>
                        <Tooltip content={actionTooltip('停止', canStop, isRunningJob ? '当前正在处理其他操作' : '作业未运行')}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={actionButtonClass(canStop, 'red')}
                            disabled={!canStop}
                            aria-label="停止"
                            onClick={() => onCancel(job)}
                          >
                            {currentOperation === 'cancel' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Square className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </Tooltip>
                        <Tooltip content={actionTooltip('保存点', canSavepoint, isRunningJob ? '当前正在处理其他操作' : '作业未运行')}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={actionButtonClass(canSavepoint, 'blue')}
                            disabled={!canSavepoint}
                            aria-label="保存点"
                            onClick={() => onSavepoint(job)}
                          >
                            {currentOperation === 'savepoint' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Camera className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </Tooltip>
                        <Tooltip content={actionTooltip('编辑', canEdit, '当前正在处理其他操作')}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={actionButtonClass(canEdit, 'slate')}
                            disabled={!canEdit}
                            aria-label="编辑"
                            onClick={() => onEdit(job)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </Tooltip>
                        <Tooltip content={actionTooltip('删除', canDelete, isRunningJob ? '作业正在运行' : '当前正在处理其他操作')}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={actionButtonClass(canDelete, 'red')}
                            disabled={!canDelete}
                            aria-label="删除"
                            onClick={() => onDelete(job)}
                          >
                            {currentOperation === 'delete' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!jobs.length ? (
                <TableEmpty colSpan={selectionMode ? 12 : 11} message="当前筛选暂无作业，可调整表头筛选或搜索条件" />
              ) : null}
            </tbody>
          </table>
          <TablePagination
            disabled={loading}
            end={Math.min(page * pageSize, totalJobs)}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            start={(page - 1) * pageSize + 1}
            total={totalJobs}
          />
        </TableShell>
      </div>
      {selectionMode ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <div className="pointer-events-auto flex h-12 max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 shadow-md">
            <div className="mr-1 flex h-8 items-center px-2 text-xs font-semibold text-slate-600">
              已选 <span className="mx-1 text-sm font-bold text-slate-900">{selectedJobs.length}</span> 项
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-slate-500"
              disabled={!selectedJobs.length}
              onClick={() => onSelectedJobIdsChange([])}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              清空
            </Button>
            <div className="mx-1 h-5 w-px bg-slate-200" />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2.5 text-slate-600"
              disabled={loading || !selectedRunnableJobs.length}
              onClick={() => onBatchRun(selectedJobs)}
            >
              <Play className="h-3.5 w-3.5" />
              运行发布版本
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:text-slate-300"
              disabled={loading || !selectedRunningJobs.length}
              onClick={() => onBatchCancel(selectedJobs)}
            >
              <Square className="h-3.5 w-3.5" />
              取消
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2.5 text-slate-600"
              disabled={loading || !selectedRunningJobs.length}
              onClick={() => onBatchSavepoint(selectedJobs)}
            >
              <Camera className="h-3.5 w-3.5" />
              Savepoint
            </Button>
            <div className="mx-1 h-5 w-px bg-slate-200" />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-slate-500"
              onClick={() => onSelectionModeChange(false)}
            >
              <X className="h-3.5 w-3.5" />
              退出选择
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
