'use client';

import { BookOpen, Bug, Camera, Check, CheckCircle2, CircleAlert, Copy, FileCode2, HelpCircle, Loader2, Maximize2, Plus, RefreshCw, Rocket, Save, Square, Terminal, Trash2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type FlinkJobResponse,
  type FlinkJobRequest,
  type FlinkJobExecutionResponse,
  useGetFlinkCheckpoints,
  useGetSystemDefaults,
  useListFlinkJobVersions,
  useListFlinkJobExecutions,
  useListFlinkJarResources,
  useListFlinkSavepoints,
  useListNotificationChannels,
} from '@/shared/api/generated';
import { Button, Field, Modal, SelectField, Tooltip } from '@/components/ui';
import { getFlinkUiUrl } from '@/features/development/lib/flink-ui';
import {
  buildRayFlowExecutionInfo,
  executionStageLabel,
  formatExecutionDuration,
  formatExecutionTime,
  isActiveExecutionStatus,
} from '@/features/development/lib/job-executions';
import { EditorToolButton, getJobStatusMeta, InfoRow, Badge } from '@/features/development/components/job-editor-shared';
import { useAuthTokenState } from '@/hooks/use-auth-token-state';
import { statusTone } from '@/shared/ui/status-tone';

interface JarConfigPanelProps {
  cancelDisabled: boolean;
  clusterName?: string;
  draft: FlinkJobRequest;
  docUrl?: string;
  onCancel: () => void;
  onChange: (value: FlinkJobRequest) => void;
  onPublish: () => void;
  onRun: () => void;
  onSave: () => void;
  publishDisabled: boolean;
  runDisabled: boolean;
  saveDisabled: boolean;
  status?: string;
}

type FlinkConfigEntry = {
  key: string;
  value: string;
};

function parseFlinkConfigEntries(rawConfig?: string): { entries: FlinkConfigEntry[]; invalid: boolean } {
  if (!rawConfig?.trim()) return { entries: [], invalid: false };
  try {
    const parsed = JSON.parse(rawConfig);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return { entries: [], invalid: true };
    }
    return {
      entries: Object.entries(parsed).map(([key, value]) => ({ key, value: String(value ?? '') })),
      invalid: false,
    };
  } catch {
    return { entries: [], invalid: true };
  }
}

function stringifyFlinkConfigEntries(entries: FlinkConfigEntry[]) {
  const config = entries.reduce<Record<string, string>>((result, entry) => {
    const key = entry.key.trim();
    if (key) {
      result[key] = entry.value;
    }
    return result;
  }, {});
  return JSON.stringify(config, null, 2);
}

function jobArgsPlaceholder(jobType?: string) {
  if (jobType === 'JAR') {
    return '--input s3://rayflow-lake/demo/input --output s3://rayflow-lake/demo/output --mode batch';
  }
  return '';
}

function shellQuote(value: string) {
  if (!value) return "''";
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function commandLine(parts: string[]) {
  return parts.filter(Boolean).join(' \\\n  ');
}

function normalizedJobName(name?: string) {
  return (name || 'rayflow-job').trim().replaceAll(/\s+/g, '-').toLowerCase();
}

function parseFlinkConfigObject(rawConfig?: string): { config: Record<string, string>; invalid: boolean } {
  if (!rawConfig?.trim()) return { config: {}, invalid: false };
  try {
    const parsed = JSON.parse(rawConfig);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return { config: {}, invalid: true };
    return {
      config: Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value ?? '')])),
      invalid: false,
    };
  } catch {
    return { config: {}, invalid: true };
  }
}

function buildFlinkRunCommand(draft: FlinkJobRequest, dependencyUris: string[], flinkConfig: Record<string, string>) {
  const parts = ['flink run'];
  Object.entries(flinkConfig).forEach(([key, value]) => {
    parts.push(`-D${key}=${shellQuote(value)}`);
  });
  dependencyUris.forEach((uri) => {
    parts.push(`-C ${shellQuote(uri)}`);
  });
  if (draft.parallelism) {
    parts.push(`-p ${draft.parallelism}`);
  }
  if (draft.savepointPath?.trim()) {
    parts.push(`-s ${shellQuote(draft.savepointPath.trim())}`);
  }

  if (draft.jobType === 'JAR') {
    if (draft.mainClass?.trim()) {
      parts.push(`-c ${shellQuote(draft.mainClass.trim())}`);
    }
    parts.push(shellQuote(draft.jarUri?.trim() || '<job-jar-uri>'));
    if (draft.args?.trim()) {
      parts.push(draft.args.trim());
    }
    return commandLine(parts);
  }

  parts.push('-c com.rayflow.flink.sql.runner.RayFlowSqlRunner');
  parts.push('/opt/rayflow/lib/rayflow-flink-sql-runner.jar');
  parts.push(`--job-name ${shellQuote(draft.jobName || 'rayflow-sql-job')}`);
  parts.push(`--sql-file ${shellQuote(`/tmp/rayflow/jobs/${normalizedJobName(draft.jobName)}.sql`)}`);
  return commandLine(parts);
}

function buildSqlGatewayCommand(draft: FlinkJobRequest) {
  const statementPath = `/tmp/rayflow/jobs/${normalizedJobName(draft.jobName)}.sql`;
  return commandLine([
    'curl -X POST "$SQL_GATEWAY_URL/v1/sessions/$SESSION_HANDLE/statements"',
    "-H 'Content-Type: application/json'",
    `--data-binary @${shellQuote(statementPath)}`,
  ]);
}

function FieldLabelWithHelp({ content, label }: { content: string; label: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <Tooltip
        content={content}
        side="right"
        tooltipClassName="w-72 whitespace-normal text-left leading-5"
      >
        <HelpCircle className="h-3.5 w-3.5 cursor-help text-slate-400" />
      </Tooltip>
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatEpochMillis(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function executionOverviewMeta(row: FlinkJobExecutionResponse | null) {
  if (row?.status === 'FINISHED') {
    return {
      icon: CheckCircle2,
      title: '执行成功',
      description: '作业已正常结束。',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      iconClassName: 'text-emerald-600',
    };
  }
  if (row?.status === 'FAILED' || row?.status === 'ERROR') {
    return {
      icon: XCircle,
      title: row.flinkJobId ? 'Flink 运行失败' : '提交失败',
      description: row.flinkJobId ? '作业已提交到 Flink，但运行过程中失败。' : '作业未成功提交到 Flink，因此没有 Flink Job ID。',
      className: 'border-rose-200 bg-rose-50 text-rose-700',
      iconClassName: 'text-rose-600',
    };
  }
  if (isActiveExecutionStatus(row?.status)) {
    return {
      icon: Loader2,
      title: '执行中',
      description: '作业仍在运行或等待提交，执行记录会继续刷新。',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      iconClassName: 'animate-spin text-amber-600',
    };
  }
  return {
    icon: Terminal,
    title: executionStageLabel(row),
    description: '当前执行状态可在 RayFlow 信息中查看。',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    iconClassName: 'text-slate-500',
  };
}

type ExecutionLogTab = 'overview' | 'flink' | 'rayflow';

function readText(source: Record<string, unknown> | undefined, key: string) {
  const value = source?.[key];
  return value === undefined || value === null || value === '' ? '-' : String(value);
}

function readNumber(source: Record<string, unknown> | undefined, key: string) {
  const value = source?.[key];
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

export function JarConfigPanel({
  cancelDisabled,
  clusterName,
  draft,
  docUrl,
  onCancel,
  onChange,
  onPublish,
  onRun,
  onSave,
  publishDisabled,
  runDisabled,
  saveDisabled,
  status,
}: JarConfigPanelProps) {
  const statusMeta = getJobStatusMeta(status);
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex min-h-[48px] shrink-0 items-center justify-between border-b border-slate-100 bg-zinc-50/50 px-4 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-primary/10 bg-primary/5">
            <FileCode2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="shrink-0 rounded-md border border-amber-200/50 bg-gradient-to-r from-amber-50 to-orange-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600">
            JAR
          </span>
          <Tooltip content={draft.jobName || '未命名作业'}>
            <span className="max-w-[150px] truncate text-sm font-bold tracking-tight text-foreground">{draft.jobName || '未命名作业'}</span>
          </Tooltip>
          {clusterName ? (
            <span className="hidden shrink-0 rounded border border-border bg-zinc-50 px-2 py-0.5 text-[9px] font-bold text-muted-foreground md:inline-block">
              运行时: {clusterName}
            </span>
          ) : null}
          {statusMeta ? (
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-bold ${statusMeta.badgeClass}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status === 'RUNNING' ? 'animate-pulse' : ''} ${statusMeta.dotClass}`} />
              {statusMeta.label}
            </span>
          ) : null}
          {docUrl ? (
            <Tooltip content="查看作业文档">
              <button
                type="button"
                onClick={() => window.open(docUrl, '_blank')}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-primary/20 bg-primary/5 text-primary transition hover:bg-primary/10"
              >
                <BookOpen className="h-3 w-3" />
              </button>
            </Tooltip>
          ) : (
            <Tooltip content="暂无作业文档链接，可在右侧配置关联">
              <span className="flex h-5 w-5 shrink-0 cursor-not-allowed items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-400">
                <BookOpen className="h-3 w-3" />
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex min-h-[38px] shrink-0 items-center justify-between gap-3 border-b border-border bg-slate-50/50 px-3 py-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <EditorToolButton
            onClick={onSave}
            disabled={saveDisabled}
            className="flex h-7 w-7 items-center justify-center p-0 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
            tooltip="保存"
          >
            <Save className="h-4 w-4" />
          </EditorToolButton>
          <EditorToolButton
            onClick={onPublish}
            disabled={publishDisabled}
            className="flex h-7 w-7 items-center justify-center p-0 text-violet-600 transition-all hover:bg-violet-50 hover:text-violet-700 disabled:opacity-30"
            tooltip="发布最新版本"
          >
            <Rocket className="h-4 w-4" />
          </EditorToolButton>
        </div>
        <div className="flex items-center gap-2">
          {status === 'RUNNING' ? (
            <EditorToolButton
              onClick={onCancel}
              disabled={cancelDisabled}
              className="flex h-7 w-7 items-center justify-center p-0 text-rose-500 transition-all hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
              tooltip="停止运行"
            >
              <Square className="h-4 w-4 fill-current" />
            </EditorToolButton>
          ) : (
            <EditorToolButton
              onClick={onRun}
              disabled={runDisabled}
              className="flex h-7 w-7 items-center justify-center p-0 text-emerald-500 transition-all hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-30"
              tooltip="运行草稿"
            >
              <Bug className="h-4 w-4" />
            </EditorToolButton>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <Field
          label="入口类 (Main Class，可选)"
          placeholder="e.g. com.example.MyFlinkJob"
          value={draft.mainClass ?? ''}
          onChange={(event) => onChange({ ...draft, mainClass: event.target.value })}
        />
      </div>
    </div>
  );
}

export function VersionsPanel({
  draft,
  job,
  onPublish,
  publishPending,
}: {
  draft: FlinkJobRequest;
  job: FlinkJobResponse | null;
  onPublish: (remark?: string) => void;
  publishPending: boolean;
}) {
  const [remark, setRemark] = useState('');
  const systemDefaults = useGetSystemDefaults({
    query: {
      refetchOnWindowFocus: false,
    },
  });
  const versions = useListFlinkJobVersions(job?.id ?? 0, {
    query: {
      enabled: Boolean(job?.id),
      refetchOnMount: 'always',
    },
  });
  const rows = versions.data ?? [];
  const versionRetention = systemDefaults.data?.jobVersionRetention ?? 5;

  function handlePublish() {
    onPublish(remark);
    setRemark('');
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2">
        <div className="text-xs font-bold text-muted-foreground">历史版本</div>
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => void handlePublish()}
          disabled={!job?.id || publishPending}
        >
          {publishPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          发布
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        <label className="block text-xs font-bold text-muted-foreground">发布备注</label>
        <textarea
          className="min-h-20 w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          placeholder="描述本次发布内容，例如：调整运行模式、更新 SQL 逻辑、变更依赖 JAR"
          value={remark}
          onChange={(event) => setRemark(event.target.value)}
          disabled={!job?.id || publishPending}
        />
        <div className="text-[11px] font-semibold text-muted-foreground">
          发布会记录当前已保存的作业定义快照；仅保留最近 {versionRetention} 个发布版本，版本号会持续递增。
        </div>
      </div>
      {!job?.id ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-zinc-50 px-3 py-5 text-center text-xs font-semibold text-muted-foreground">
          请先选择并保存作业，再发布历史版本。
        </div>
      ) : versions.isLoading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg border border-border bg-slate-50" />
          ))}
        </div>
      ) : rows.length ? (
        <div className="mt-4 max-h-[calc(100vh-16rem)] space-y-2 overflow-y-auto pr-1">
          {rows.map((version) => (
            <div key={version.id ?? version.versionNo} className="rounded-lg border border-border bg-white px-4 py-3 text-xs shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone="info">{version.versionName ?? `V${version.versionNo ?? '-'}`}</Badge>
                    <span className="font-bold text-slate-800">版本 #{version.versionNo ?? '-'}</span>
                  </div>
                  <div className="mt-2 break-words font-medium leading-5 text-muted-foreground">
                    {version.remark || '无发布备注'}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[11px] font-semibold text-muted-foreground">
                  {formatDateTime(version.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-zinc-50 px-3 py-5 text-center text-xs font-semibold text-muted-foreground">
          暂无历史版本。点击发布后会记录当前作业定义快照。
        </div>
      )}
      <div className="mt-4 space-y-1 border-t border-border-subtle pt-3 text-xs font-medium text-muted-foreground">
        <InfoRow label="当前作业" value={draft.jobName || job?.jobName || '-'} />
        <InfoRow label="作业类型" value={draft.jobType || job?.jobType || '-'} />
        <InfoRow label="更新时间" value={formatDateTime(job?.updatedAt)} />
      </div>
    </div>
  );
}

export function SavepointsPanel({
  clusterAddress,
  draft,
  isRunning,
  job,
  onChange,
  onTrigger,
}: {
  clusterAddress?: string;
  draft: FlinkJobRequest;
  isRunning: boolean;
  job: FlinkJobResponse | null;
  onChange: (value: FlinkJobRequest) => void;
  onTrigger: () => void;
}) {
  const statusMeta = getJobStatusMeta(job?.status);
  const hasToken = useAuthTokenState();
  const savepoints = useListFlinkSavepoints(job?.id ?? 0, {
    query: {
      enabled: hasToken && Boolean(job?.id),
      refetchOnMount: 'always',
    },
  });
  const checkpoints = useGetFlinkCheckpoints(job?.id ?? 0, {
    query: {
      enabled: hasToken && Boolean(job?.id && job?.flinkJobId),
      refetchOnMount: 'always',
      retry: false,
    },
  });
  const savepointRows = savepoints.data ?? [];
  const checkpointCounts = checkpoints.data?.counts as Record<string, unknown> | undefined;
  const checkpointLatest = checkpoints.data?.latest as Record<string, unknown> | undefined;
  const latestCompleted = checkpointLatest?.completed as Record<string, unknown> | undefined;
  const latestFailed = checkpointLatest?.failed as Record<string, unknown> | undefined;
  const latestRestored = checkpointLatest?.restored as Record<string, unknown> | undefined;
  const checkpointHistory = (checkpoints.data?.history ?? []).slice(0, 5);
  const flinkJobIdNode = job?.flinkJobId ? (
    clusterAddress ? (
      <a href={getFlinkUiUrl(clusterAddress, job)} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
        {job.flinkJobId}
      </a>
    ) : (
      job.flinkJobId
    )
  ) : (
    '-'
  );

  return (
    <div className="rounded-xl border border-border-subtle bg-white p-5 shadow-card">
      <div className="border-b border-border-subtle pb-2 text-xs font-bold text-muted-foreground">保存点 (Savepoints)</div>
      <div className="mt-3 space-y-1 text-xs font-medium text-muted-foreground">
        <InfoRow label="Flink Job ID" value={flinkJobIdNode} />
        <InfoRow label="当前状态" value={statusMeta?.label || '-'} />
        <InfoRow label="恢复路径" value={job?.savepointPath || '-'} />
      </div>
      <div className="mt-4 rounded-lg border border-border bg-zinc-50 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-muted-foreground">Checkpoint 状态</div>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void checkpoints.refetch()} disabled={!job?.flinkJobId || checkpoints.isFetching}>
            刷新
          </Button>
        </div>
        {!job?.flinkJobId ? (
          <div className="rounded-md border border-dashed border-border bg-white px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
            作业尚未提交到 Flink，暂无 Checkpoint 状态。
          </div>
        ) : checkpoints.isLoading ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-md bg-white" />
            <div className="h-20 animate-pulse rounded-md bg-white" />
          </div>
        ) : checkpoints.isError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold text-amber-700">
            无法读取 Flink Checkpoint 状态。作业可能已结束，或 Flink Runtime 不再保留该 Job ID。
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['成功', readNumber(checkpointCounts, 'completed')],
                ['失败', readNumber(checkpointCounts, 'failed')],
                ['进行中', readNumber(checkpointCounts, 'in_progress')],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-white px-2 py-2">
                  <div className="text-base font-bold text-slate-800">{value}</div>
                  <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <InfoRow label="最近成功 ID" value={readText(latestCompleted, 'id')} />
              <InfoRow label="最近成功路径" value={readText(latestCompleted, 'external_path')} />
              <InfoRow label="最近失败 ID" value={readText(latestFailed, 'id')} />
              <InfoRow label="最近恢复路径" value={readText(latestRestored, 'external_path')} />
            </div>
            {checkpointHistory.length ? (
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {checkpointHistory.map((item, index) => (
                  <div key={`${String(item.id ?? 'checkpoint')}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">
                    <span className="min-w-0 truncate">#{String(item.id ?? '-')} · {String(item.status ?? '-')}</span>
                    <span className="shrink-0">{formatEpochMillis(item.trigger_timestamp)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div className="mt-4">
        <FieldLabelWithHelp
          label="下次提交恢复路径"
          content="用于重新提交作业时从指定 savepoint 恢复状态。它不是 checkpoint 存储目录；只有恢复、迁移或升级作业时才需要填写。"
        />
        <input
          value={draft.savepointPath ?? ''}
          onChange={(event) => onChange({ ...draft, savepointPath: event.target.value })}
          placeholder="s3://rayflow-artifacts/savepoints/job/savepoint-xxx"
          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none transition duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-50"
        />
      </div>
      <Button onClick={onTrigger} disabled={!job || !isRunning} variant="primary" className="mt-4 flex w-full items-center justify-center gap-1.5">
        <Camera className="h-3.5 w-3.5" />
        触发 Savepoint
      </Button>
      {!isRunning ? <div className="mt-3 text-center text-xs font-medium text-muted-foreground">只有运行中的作业可以触发 Savepoint。</div> : null}
      <div className="mt-5 border-t border-border-subtle pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-muted-foreground">快照列表</div>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void savepoints.refetch()} disabled={!job?.id || savepoints.isFetching}>
            刷新
          </Button>
        </div>
        {savepoints.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg border border-border bg-slate-50" />
            ))}
          </div>
        ) : savepointRows.length ? (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {savepointRows.map((row) => {
              const restorePath = row.location || row.targetDirectory || '';
              return (
                <div key={row.id ?? row.requestId ?? row.createdAt} className="rounded-lg border border-border bg-white p-3 text-xs shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700">{row.status || 'TRIGGERED'}</span>
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{formatDateTime(row.createdAt)}</span>
                  </div>
                  <div className="space-y-1 text-muted-foreground">
                    <InfoRow label="位置" value={restorePath || '-'} />
                    <InfoRow label="Request ID" value={row.requestId || '-'} />
                    <InfoRow label="停止作业" value={row.cancelJob ? '是' : '否'} />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-2 h-7 px-2 text-xs"
                    disabled={!restorePath}
                    onClick={() => onChange({ ...draft, savepointPath: restorePath })}
                  >
                    用于恢复
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-zinc-50 px-3 py-5 text-center text-xs font-semibold text-muted-foreground">
            暂无 Savepoint 记录。运行中的作业触发后会在这里出现。
          </div>
        )}
      </div>
    </div>
  );
}

export function HistoryPanel({ job }: { job: FlinkJobResponse | null }) {
  const hasToken = useAuthTokenState();
  const [logRowId, setLogRowId] = useState<number | null>(null);
  const [syncingVisible, setSyncingVisible] = useState(false);
  const mountedRef = useRef(false);
  const executions = useListFlinkJobExecutions(job?.id ?? 0, {
    query: {
      enabled: hasToken && Boolean(job?.id),
      refetchInterval: (query) => {
        const data = query.state.data as Array<{ status?: string }> | undefined;
        return job?.status === 'RUNNING' || data?.some((row) => isActiveExecutionStatus(row.status)) ? 3000 : false;
      },
      refetchOnMount: 'always',
    },
  });
  const rows = executions.data ?? [];
  const logRow = rows.find((row) => row.id === logRowId) ?? null;
  const showSyncing = executions.isFetching || syncingVisible;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (executions.isFetching) {
      window.setTimeout(() => {
        if (mountedRef.current) setSyncingVisible(true);
      }, 0);
      return;
    }
    if (!syncingVisible) return;
    const timer = window.setTimeout(() => setSyncingVisible(false), 650);
    return () => window.clearTimeout(timer);
  }, [executions.isFetching, syncingVisible]);

  return (
    <div className="rounded-xl border border-border-subtle bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2">
        <div className="text-xs font-bold text-muted-foreground">执行记录</div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => void executions.refetch()}
          disabled={!job?.id}
          aria-busy={showSyncing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${showSyncing ? 'animate-spin [animation-duration:1.8s]' : ''}`} />
          {showSyncing ? '同步中' : '刷新'}
        </Button>
      </div>
      {!job?.id ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-zinc-50 px-3 py-5 text-center text-xs font-semibold text-muted-foreground">
          请选择一个作业查看执行记录。
        </div>
      ) : executions.isLoading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg border border-border bg-slate-50" />
          ))}
        </div>
      ) : rows.length ? (
        <div className="mt-4 max-h-[calc(100vh-10rem)] space-y-3 overflow-y-auto pr-1">
          {rows.map((row) => {
            const statusMeta = getJobStatusMeta(row.status);
            return (
              <div key={row.id ?? `${row.flinkJobId}-${row.startTime}`} className="overflow-hidden rounded-lg border border-border bg-white text-xs shadow-sm">
                <div className="flex w-full items-start justify-between gap-3 bg-slate-50/80 px-4 py-3 text-left">
                  <span className="min-w-0 space-y-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-800">执行 #{row.id ?? '-'}</span>
                      <Badge tone={statusTone(row.status)}>{statusMeta?.label || row.status || '未知'}</Badge>
                    </span>
                    <span className="block text-muted-foreground">开始于 {formatDateTime(row.startTime)}</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 border-t border-border/70 px-4 py-3 text-muted-foreground sm:grid-cols-2">
                  <div className="min-w-0 rounded-md bg-zinc-50 px-3 py-2 sm:col-span-2">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">Flink Job ID</div>
                    <div className="mt-1 break-all font-mono text-[11px] font-semibold leading-5 text-slate-700" title={row.flinkJobId || '-'}>
                      {row.flinkJobId || '-'}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-md bg-zinc-50 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">结束时间</div>
                    <div className="mt-1 whitespace-nowrap font-semibold text-slate-700">{formatDateTime(row.endTime)}</div>
                  </div>
                  <div className="min-w-0 rounded-md bg-zinc-50 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">耗时</div>
                    <div className="mt-1 font-semibold text-slate-700">{formatExecutionDuration(row.duration)}</div>
                  </div>
                </div>
                <div className="border-t border-border/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-muted-foreground">执行日志</div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setLogRowId(row.id ?? null)}
                        disabled={!row.id}
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        查看日志
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-zinc-50 px-3 py-5 text-center text-xs font-semibold text-muted-foreground">
          暂无执行记录。运行草稿或运行发布版本后会在这里记录每一次执行。
        </div>
      )}
      <ExecutionLogModal
        key={logRowId ?? 'closed'}
        job={job}
        onClose={() => setLogRowId(null)}
        open={Boolean(logRow)}
        row={logRow}
      />
    </div>
  );
}

function ExecutionLogModal({
  job,
  onClose,
  open,
  row,
}: {
  job: FlinkJobResponse | null;
  onClose: () => void;
  open: boolean;
  row: FlinkJobExecutionResponse | null;
}) {
  const statusMeta = getJobStatusMeta(row?.status);
  const [activeTab, setActiveTab] = useState<ExecutionLogTab>('flink');
  const flinkLog = row?.errorLog?.trim() || '';
  const rayFlowInfo = buildRayFlowExecutionInfo(row, job);
  const overviewMeta = executionOverviewMeta(row);
  const OverviewIcon = overviewMeta.icon;

  const tabs: Array<{ key: ExecutionLogTab; label: string }> = [
    { key: 'overview', label: '概览' },
    { key: 'flink', label: 'Flink 错误' },
    { key: 'rayflow', label: 'RayFlow 信息' },
  ];

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={row?.id ? `执行日志 #${row.id}` : '执行日志'}
      titleExtra={<Badge tone={statusTone(row?.status)}>{statusMeta?.label || row?.status || '未知'}</Badge>}
      showSubmit={false}
      cancelLabel="关闭"
      className="h-[86vh] max-w-6xl"
      bodyClassName="overflow-hidden p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid shrink-0 grid-cols-1 gap-2 border-b border-border-subtle bg-slate-50/80 p-4 text-xs sm:grid-cols-4">
          <div className="rounded-md bg-white px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">开始时间</div>
            <div className="mt-1 font-semibold text-slate-700">{formatExecutionTime(row?.startTime)}</div>
          </div>
          <div className="rounded-md bg-white px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">结束时间</div>
            <div className="mt-1 font-semibold text-slate-700">{formatExecutionTime(row?.endTime)}</div>
          </div>
          <div className="rounded-md bg-white px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">耗时</div>
            <div className="mt-1 font-semibold text-slate-700">{formatExecutionDuration(row?.duration)}</div>
          </div>
          <div className="min-w-0 rounded-md bg-white px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Flink Job ID</div>
            <div className="mt-1 truncate font-mono text-[11px] font-semibold text-slate-700" title={row?.flinkJobId || '-'}>
              {row?.flinkJobId || '-'}
            </div>
          </div>
        </div>
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-white px-4">
          <div className="flex items-center gap-1 rounded-md bg-slate-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`h-7 rounded px-3 text-xs font-bold transition-colors ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-muted-foreground hover:text-slate-900'}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'overview' ? (
          <div className="min-h-0 flex-1 overflow-auto bg-white p-5">
            <div className={`mb-4 flex items-start gap-3 rounded-lg border p-4 ${overviewMeta.className}`}>
              <OverviewIcon className={`mt-0.5 h-6 w-6 shrink-0 ${overviewMeta.iconClassName}`} />
              <div className="min-w-0">
                <div className="text-base font-bold">{overviewMeta.title}</div>
                <div className="mt-1 text-sm font-medium leading-6 opacity-80">{overviewMeta.description}</div>
              </div>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-lg border border-border bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  <OverviewIcon className={`h-4 w-4 ${overviewMeta.iconClassName}`} />
                  执行阶段
                </div>
                <div className="mt-2 text-base font-bold text-slate-900">{executionStageLabel(row)}</div>
                <div className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
                  当前执行的生命周期阶段，用来区分提交失败、Flink 运行失败、成功完成和执行中。
                </div>
              </div>
              <div className="rounded-lg border border-border bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  {flinkLog ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-amber-600" />}
                  日志可用性
                </div>
                <div className="mt-2 text-base font-bold text-slate-900">{flinkLog ? '已采集 Flink 错误日志' : '暂无 Flink 错误日志'}</div>
                <div className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
                  {flinkLog ? '可在「Flink 错误」tab 查看完整错误堆栈。' : '当前执行没有错误日志，或 Flink Runtime 未返回异常信息。'}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'flink' ? (
          <div className="flex min-h-0 flex-1 flex-col bg-slate-950">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-slate-800 px-4 text-xs font-bold text-zinc-400">
              <Terminal className="h-3.5 w-3.5 text-amber-500" />
              Flink 错误日志
            </div>
            <pre className="min-h-0 flex-1 overflow-auto p-5 font-mono text-[12px] leading-5 text-slate-100">
              {flinkLog || '暂无 Flink 错误日志。'}
            </pre>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col bg-slate-950">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-slate-800 px-4 text-xs font-bold text-zinc-400">
              <Terminal className="h-3.5 w-3.5 text-amber-500" />
              RayFlow 执行信息
            </div>
            <pre className="min-h-0 flex-1 overflow-auto p-5 font-mono text-[12px] leading-5 text-slate-100">
              {rayFlowInfo}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function JobInfoPanel({ job, clusterAddress }: { job: FlinkJobResponse | null; clusterAddress?: string }) {
  const statusMeta = getJobStatusMeta(job?.status);
  const flinkJobIdNode = job?.flinkJobId ? (
    clusterAddress ? (
      <a href={getFlinkUiUrl(clusterAddress, job)} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
        {job.flinkJobId}
      </a>
    ) : (
      job.flinkJobId
    )
  ) : (
    '-'
  );

  return (
    <div className="rounded-xl border border-border-subtle bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2">
        <div className="text-xs font-bold text-muted-foreground">信息详情</div>
        <Badge tone={statusTone(job?.status)}>{statusMeta?.label || '未知状态'}</Badge>
      </div>
      <div className="mt-3 space-y-1 text-xs font-medium text-muted-foreground">
        <InfoRow label="作业 ID" value={job?.id ? String(job.id) : '-'} />
        <InfoRow label="Flink Job ID" value={flinkJobIdNode} />
        <InfoRow label="作业名称" value={job?.jobName || '-'} />
        <InfoRow label="作业类型" value={job?.jobType || '-'} />
        <InfoRow label="提交方式" value={job?.submitType || '-'} />
        <InfoRow label="执行模式" value={job?.executionMode || '-'} />
        <InfoRow label="创建时间" value={job?.createdAt || '-'} />
        <InfoRow label="更新时间" value={job?.updatedAt || '-'} />
      </div>
    </div>
  );
}

export function SettingsPanel({
  clusterList,
  draft,
  groupOptions,
  onChange,
}: {
  clusterList: Array<{ id?: number; clusterName?: string; clusterScope?: string }>;
  draft: FlinkJobRequest;
  groupOptions: string[];
  onChange: (value: FlinkJobRequest) => void;
}) {
  const hasToken = useAuthTokenState();
  const [flinkConfigMode, setFlinkConfigMode] = useState<'visual' | 'json'>('visual');
  const [visualFlinkConfigEntries, setVisualFlinkConfigEntries] = useState<FlinkConfigEntry[]>([]);
  const lastSyncedFlinkConfigRef = useRef<string | undefined>(undefined);
  const jarResources = useListFlinkJarResources(undefined, { query: { enabled: hasToken, refetchOnMount: 'always' } });
  const activeJarResources = useMemo(
    () => (jarResources.data?.list ?? []).filter((resource) => resource.status === 'ACTIVE' && resource.id),
    [jarResources.data?.list],
  );
  const selectedDependencyIds = useMemo(
    () => new Set((draft.dependencyRefs ?? '').split(',').map((value) => value.trim()).filter(Boolean)),
    [draft.dependencyRefs],
  );

  function toggleDependency(resourceId: number) {
    const nextIds = new Set(selectedDependencyIds);
    const idValue = String(resourceId);
    if (nextIds.has(idValue)) {
      nextIds.delete(idValue);
    } else {
      nextIds.add(idValue);
    }
    onChange({ ...draft, dependencyRefs: Array.from(nextIds).join(',') });
  }

  const jarResourceOptions = useMemo(
    () => [
      { label: '手动填写 JAR URI', value: '' },
      ...activeJarResources.map((resource) => ({
        label: `${resource.resourceName ?? '-'}:${resource.resourceVersion ?? '1.0.0'}`,
        value: resource.storageUri ?? '',
      })).filter((option) => option.value),
    ],
    [activeJarResources],
  );

  const selectedJarResourceUri = useMemo(
    () => jarResourceOptions.some((option) => option.value && option.value === draft.jarUri) ? draft.jarUri ?? '' : '',
    [draft.jarUri, jarResourceOptions],
  );
  const flinkConfigState = useMemo(() => parseFlinkConfigEntries(draft.flinkConfig), [draft.flinkConfig]);

  useEffect(() => {
    if (draft.flinkConfig === lastSyncedFlinkConfigRef.current) return;
    lastSyncedFlinkConfigRef.current = draft.flinkConfig;
    setVisualFlinkConfigEntries(flinkConfigState.invalid ? [] : flinkConfigState.entries);
  }, [draft.flinkConfig, flinkConfigState.entries, flinkConfigState.invalid]);

  function updateFlinkConfigEntries(entries: FlinkConfigEntry[]) {
    const nextConfig = stringifyFlinkConfigEntries(entries);
    lastSyncedFlinkConfigRef.current = nextConfig;
    setVisualFlinkConfigEntries(entries);
    onChange({ ...draft, flinkConfig: nextConfig });
  }

  function updateFlinkConfigEntry(index: number, patch: Partial<FlinkConfigEntry>) {
    updateFlinkConfigEntries(visualFlinkConfigEntries.map((entry, currentIndex) => (
      currentIndex === index ? { ...entry, ...patch } : entry
    )));
  }

  function addFlinkConfigEntry() {
    updateFlinkConfigEntries([...visualFlinkConfigEntries, { key: '', value: '' }]);
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-white p-5 shadow-card">
      <div className="mb-3 border-b border-border-subtle pb-2 text-xs font-bold text-muted-foreground">作业参数配置</div>
      <div className="space-y-3">
        <Field label="作业名称" value={draft.jobName ?? ''} onChange={(event) => onChange({ ...draft, jobName: event.target.value })} />
        <SelectField
          label="所属目录"
          value={draft.jobGroup ?? ''}
          onValueChange={(value) => onChange({ ...draft, jobGroup: value })}
          options={[{ label: '未分组', value: '' }, ...groupOptions.map((group) => ({ label: group, value: group }))]}
        />
        <SelectField
          label="作业类型"
          value={draft.jobType ?? 'SQL'}
          onValueChange={(value) => onChange({
            ...draft,
            args: value === 'SQL' ? '' : draft.args,
            content: value === 'JAR' ? '' : draft.content,
            dependencyRefs: value === 'SQL' ? draft.dependencyRefs : '',
            executionMode: value === 'JAR' ? 'standalone' : draft.executionMode,
            jobType: value,
            runtimeMode: value === 'SQL' ? (draft.runtimeMode || 'STREAMING') : undefined,
            submitType: value === 'JAR' ? 'REST' : draft.submitType,
          })}
          options={[
            { label: 'SQL', value: 'SQL' },
            { label: 'JAR', value: 'JAR' },
          ]}
        />
        {draft.jobType === 'SQL' ? (
          <div>
            <FieldLabelWithHelp
              label="运行模式"
              content="决定 SQL 作业按有限数据批处理执行，还是按无界数据流持续执行。RayFlow 提交时会自动生成 execution.runtime-mode SET，不需要在 SQL 里手写。"
            />
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-slate-50 p-1">
              {[
                { label: '流处理', value: 'STREAMING' },
                { label: '批处理', value: 'BATCH' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onChange({ ...draft, runtimeMode: item.value })}
                  className={`h-8 rounded-md text-xs font-bold transition ${
                    (draft.runtimeMode || 'STREAMING') === item.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-muted-foreground hover:text-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <SelectField
          label="运行时"
          value={String(draft.clusterId ?? '')}
          onValueChange={(value) => onChange({ ...draft, clusterId: Number(value) || undefined })}
          options={[
            { label: '选择运行时', value: '' },
            ...clusterList.map((cluster) => ({ label: cluster.clusterName ?? '-', value: String(cluster.id ?? '') })),
          ]}
        />
        {draft.jobType === 'SQL' ? (
          <SelectField
            label="提交方式"
            value={draft.submitType ?? 'REST'}
            onValueChange={(value) => onChange({
              ...draft,
              submitType: value,
              executionMode: value === 'K8S_APPLICATION' ? 'k8s-application' : 'standalone',
            })}
            options={[
              { label: 'REST API (RayFlow SQL Runner)', value: 'REST' },
              { label: 'SQL Gateway', value: 'SQL_GATEWAY' },
            ]}
          />
        ) : null}
        <SelectField
          label="执行模式"
          value={draft.executionMode ?? 'standalone'}
          onValueChange={(value) => onChange({ ...draft, executionMode: value })}
          options={[
            { label: 'Standalone Session', value: 'standalone' },
            { label: 'K8s Application (预留)', value: 'k8s-application' },
          ]}
        />
        <Field label="并行度" type="number" value={String(draft.parallelism ?? 1)} onChange={(event) => onChange({ ...draft, parallelism: Number(event.target.value) || 1 })} />
        {draft.jobType === 'JAR' || draft.executionMode === 'k8s-application' ? (
          <>
            <SelectField
              label="JAR 资源"
              value={selectedJarResourceUri}
              onValueChange={(value) => onChange({ ...draft, jarUri: value })}
              options={jarResourceOptions}
            />
            <Field
              label="JAR URI"
              value={draft.jarUri ?? ''}
              onChange={(event) => onChange({ ...draft, jarUri: event.target.value })}
              placeholder="s3://rayflow-artifacts/flink-jars/default/app/1.0.0/app-1.0.0.jar"
            />
          </>
        ) : null}
        {draft.executionMode === 'k8s-application' ? (
          <Field
            label="作业镜像"
            value={draft.applicationImage ?? ''}
            onChange={(event) => onChange({ ...draft, applicationImage: event.target.value })}
            placeholder="registry.example.com/rayflow/flink-job:2.2.1"
          />
        ) : null}
        {draft.jobType === 'JAR' ? (
          <div>
            <FieldLabelWithHelp
              label="启动参数"
              content="提交 JAR 作业时传给 main 方法的 Program Arguments，例如输入路径、输出路径、业务日期等。"
            />
            <input
              value={draft.args ?? ''}
              onChange={(event) => onChange({ ...draft, args: event.target.value })}
              placeholder={jobArgsPlaceholder(draft.jobType)}
              className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none transition duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-50"
            />
          </div>
        ) : null}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <FieldLabelWithHelp
              label="Flink 配置"
              content="作业级 Flink configuration，提交时会转换为 flinkConfiguration 或 flink run 的 -D 参数。适合 checkpoint、restart strategy、pipeline.name、state 路径等运行治理配置；SQL 语义相关配置建议写在 SQL SET 中。"
            />
            <div className="flex rounded-lg border border-border bg-slate-50 p-0.5">
              {[
                { label: '可视化', value: 'visual' },
                { label: 'JSON', value: 'json' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFlinkConfigMode(item.value as 'visual' | 'json')}
                  className={`h-6 rounded-md px-2 text-[11px] font-bold transition ${flinkConfigMode === item.value ? 'bg-white text-slate-900 shadow-sm' : 'text-muted-foreground hover:text-slate-700'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-white p-2.5">
            {flinkConfigMode === 'json' ? (
              <>
                <textarea
                  value={draft.flinkConfig ?? '{}'}
                  onChange={(event) => onChange({ ...draft, flinkConfig: event.target.value })}
                  placeholder={'{\n  "execution.checkpointing.interval": "30s",\n  "state.checkpoints.dir": "s3://rayflow-artifacts/checkpoints/demo",\n  "pipeline.operator-chaining": "true"\n}'}
                  rows={8}
                  className="min-h-40 w-full rounded-lg border border-border bg-white px-3 py-2.5 font-mono text-xs leading-5 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
                <div className="text-[11px] leading-5 text-muted-foreground">
                  JSON 会原样保存到作业配置，并在 REST 提交时作为 Flink `flinkConfiguration` 传入。
                </div>
              </>
            ) : (
              <>
                {flinkConfigState.invalid ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    当前 Flink 配置不是合法 JSON 对象，可切到 JSON 修正，或重置后重新添加配置项。
                    <Button type="button" size="sm" variant="ghost" className="ml-2 h-6 px-2 text-xs" onClick={() => onChange({ ...draft, flinkConfig: '{}' })}>重置</Button>
                  </div>
                ) : null}
                {!flinkConfigState.invalid ? (
                  <div className="space-y-1.5">
                    {visualFlinkConfigEntries.length ? (
                      visualFlinkConfigEntries.map((entry, index) => (
                        <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_2rem] gap-1.5">
                          <input
                            value={entry.key}
                            onChange={(event) => updateFlinkConfigEntry(index, { key: event.target.value })}
                            placeholder="配置键，例如 execution.checkpointing.interval"
                            className="h-8 min-w-0 rounded-md border border-border bg-white px-2 text-xs font-semibold outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                          />
                          <input
                            value={entry.value}
                            onChange={(event) => updateFlinkConfigEntry(index, { value: event.target.value })}
                            placeholder="配置值，例如 30s"
                            className="h-8 min-w-0 rounded-md border border-border bg-white px-2 text-xs outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-rose-600"
                            aria-label="删除配置"
                            onClick={() => updateFlinkConfigEntries(visualFlinkConfigEntries.filter((_, currentIndex) => currentIndex !== index))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-muted-foreground">
                        暂无作业级 Flink 配置。点击下方按钮添加配置项，或切换 JSON 粘贴整段配置。
                      </div>
                    )}
                    <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => addFlinkConfigEntry()}>
                      <Plus className="h-3.5 w-3.5" />
                      添加自定义配置
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
        {draft.jobType === 'SQL' ? (
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">JAR 依赖资源</div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-white p-2">
              {activeJarResources.length > 0 ? (
                activeJarResources.map((resource) => {
                  const idValue = String(resource.id);
                  const checked = selectedDependencyIds.has(idValue);
                  return (
                    <label key={resource.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/20"
                        checked={checked}
                        onChange={() => resource.id && toggleDependency(resource.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{resource.resourceName}</span>
                      <span className="shrink-0 text-slate-400">{resource.resourceVersion ?? '1.0.0'}</span>
                    </label>
                  );
                })
              ) : (
                <div className="px-2 py-2 text-xs font-medium text-muted-foreground">资源中心暂无启用的 JAR 资源</div>
              )}
            </div>
          </div>
        ) : null}
        <Field label="描述" value={draft.description ?? ''} onChange={(event) => onChange({ ...draft, description: event.target.value })} />
        <Field label="文档链接" placeholder="例如：https://docs.example.com/job-doc" value={draft.docUrl ?? ''} onChange={(event) => onChange({ ...draft, docUrl: event.target.value })} />
      </div>
    </div>
  );
}

export function AlertSettingsPanel({
  draft,
  onChange,
}: {
  draft: FlinkJobRequest;
  onChange: (value: FlinkJobRequest) => void;
}) {
  const hasToken = useAuthTokenState();
  const channels = useListNotificationChannels({ is_pager: 0 }, { query: { enabled: hasToken, refetchOnMount: 'always' } });
  const enabledChannels = useMemo(
    () => (channels.data?.list ?? []).filter((channel) => channel.enabled !== false && channel.id),
    [channels.data?.list],
  );
  const channelOptions = useMemo(
    () => [
      { label: '不启用告警渠道', value: '' },
      ...enabledChannels.map((channel) => ({
        label: `${channel.name} (${channel.type})`,
        value: String(channel.id),
      })),
    ],
    [enabledChannels],
  );
  const alertRules = useMemo(
    () => new Set((draft.alertRule ?? 'FAILED').split(',').map((s) => s.trim()).filter(Boolean)),
    [draft.alertRule],
  );
  const selectedChannel = useMemo(
    () => enabledChannels.find((channel) => channel.id === draft.alertChannelId),
    [draft.alertChannelId, enabledChannels],
  );

  function toggleAlertRule(rule: string) {
    const nextRules = new Set(alertRules);
    if (nextRules.has(rule)) {
      nextRules.delete(rule);
    } else {
      nextRules.add(rule);
    }
    onChange({ ...draft, alertRule: Array.from(nextRules).join(',') });
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-white p-5 shadow-card">
      <div className="mb-3 border-b border-border-subtle pb-2 text-xs font-bold text-muted-foreground">告警配置</div>
      <div className="space-y-4">
        <SelectField
          label="通知渠道"
          value={String(draft.alertChannelId ?? '')}
          onValueChange={(value) => {
            const channelId = Number(value) || undefined;
            onChange({
              ...draft,
              alertChannelId: channelId,
              alertRule: channelId ? (draft.alertRule || 'FAILED') : '',
            });
          }}
          options={channelOptions}
        />
        {draft.alertChannelId ? (
          <>
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">触发策略</div>
              <div className="grid gap-2 rounded-lg border border-border bg-slate-50/50 p-2.5">
                {[
                  { label: '运行失败', value: 'FAILED' },
                  { label: '作业取消', value: 'CANCELED' },
                  { label: '运行完成', value: 'FINISHED' },
                ].map((item) => (
                  <label key={item.value} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/20"
                      checked={alertRules.has(item.value)}
                      onChange={() => toggleAlertRule(item.value)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-zinc-50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <InfoRow label="当前渠道" value={selectedChannel ? `${selectedChannel.name} (${selectedChannel.type})` : '当前渠道不可用'} />
              <InfoRow label="触发条件" value={alertRules.size ? Array.from(alertRules).join(', ') : '未选择'} />
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-zinc-50 px-3 py-4 text-center text-xs font-semibold text-muted-foreground">
            当前作业未启用告警。选择通知渠道后可配置触发策略。
          </div>
        )}
      </div>
    </div>
  );
}

export function CommandPreviewPanel({ draft }: { draft: FlinkJobRequest }) {
  const hasToken = useAuthTokenState();
  const [copied, setCopied] = useState(false);
  const jarResources = useListFlinkJarResources(undefined, { query: { enabled: hasToken, refetchOnMount: 'always' } });
  const dependencyIds = useMemo(
    () => new Set((draft.dependencyRefs ?? '').split(',').map((value) => Number(value.trim())).filter(Boolean)),
    [draft.dependencyRefs],
  );
  const dependencyUris = useMemo(
    () => (jarResources.data?.list ?? [])
      .filter((resource) => resource.id && dependencyIds.has(resource.id) && resource.storageUri)
      .map((resource) => resource.storageUri as string),
    [dependencyIds, jarResources.data?.list],
  );
  const flinkConfigState = useMemo(() => parseFlinkConfigObject(draft.flinkConfig), [draft.flinkConfig]);
  const command = useMemo(() => {
    if (draft.jobType === 'SQL' && draft.submitType === 'SQL_GATEWAY') {
      return buildSqlGatewayCommand(draft);
    }
    return buildFlinkRunCommand(draft, dependencyUris, flinkConfigState.config);
  }, [dependencyUris, draft, flinkConfigState.config]);
  const commandType = draft.jobType === 'SQL' && draft.submitType === 'SQL_GATEWAY'
    ? 'SQL Gateway REST 提交'
    : 'Flink CLI 提交';

  async function copyCommand() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-border-subtle pb-2">
        <div className="text-xs font-bold text-muted-foreground">提交命令预览</div>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void copyCommand()}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-zinc-50 px-3 py-2 text-xs font-medium text-muted-foreground">
          <InfoRow label="提交形态" value={commandType} />
          <InfoRow label="作业类型" value={draft.jobType || '-'} />
          <InfoRow label="运行模式" value={draft.jobType === 'SQL' ? ((draft.runtimeMode || 'STREAMING') === 'BATCH' ? '批处理' : '流处理') : '-'} />
          <InfoRow label="提交方式" value={draft.submitType || '-'} />
          <InfoRow label="依赖 JAR" value={dependencyUris.length ? `${dependencyUris.length} 个` : '无'} />
        </div>
        {flinkConfigState.invalid ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            当前 Flink 配置不是合法 JSON 对象，命令预览已暂时忽略 `-D` 配置。
          </div>
        ) : null}
        {draft.jobType === 'SQL' && draft.submitType === 'SQL_GATEWAY' ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-700">
            SQL Gateway 不是 `flink run` 提交模型，最终会通过 Gateway 会话提交 SQL statement。
          </div>
        ) : null}
        <pre className="max-h-[420px] overflow-auto rounded-lg border border-slate-900 bg-slate-950 p-3 text-[11px] font-semibold leading-5 text-slate-100">
          <code>{command}</code>
        </pre>
      </div>
    </div>
  );
}
