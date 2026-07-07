'use client';

import { RefreshCw, Terminal } from 'lucide-react';
import { Button, Modal, Badge } from '@/components/ui';
import type { Workflow } from '@/features/scheduler/types';
import { formatBackendUtcDateTime, formatBackendUtcDuration } from '@/lib/date';
import type {
  SchedulerExecutionLogResponse,
  SchedulerExecutionResponse,
  SchedulerNodeExecutionResponse,
} from '@/shared/api/generated';

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    CANCELED: '已取消',
    FAILED: '失败',
    PENDING: '等待中',
    RETRYING: '重试中',
    RUNNING: '运行中',
    SKIPPED: '已跳过',
    SUCCESS: '成功',
  };
  return status ? labels[status] ?? status : '-';
}

function executionStatusTone(status?: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'SUCCESS') return 'success';
  if (status === 'RUNNING' || status === 'RETRYING' || status === 'PENDING') return 'warning';
  if (status === 'FAILED') return 'danger';
  if (status === 'CANCELED') return 'neutral';
  return 'neutral';
}

function logColorClass(log: SchedulerExecutionLogResponse) {
  if (log.level === 'ERROR') return 'text-rose-400 font-bold';
  if (log.level === 'WARN' || log.level === 'WARNING') return 'text-amber-400';
  if (log.eventType?.includes('SUCCESS')) return 'text-emerald-400 font-semibold';
  if (log.eventType?.includes('FAILED')) return 'text-rose-400 font-bold';
  return 'text-zinc-300';
}

export function SchedulerExecutionLogsModal({
  detailsError,
  executions,
  loadingDetails,
  loadingExecutions,
  logs,
  nodes,
  onClose,
  onRefresh,
  onSelectExecution,
  open,
  selectedExecutionId,
  workflow,
}: {
  detailsError?: string;
  executions: SchedulerExecutionResponse[];
  loadingDetails: boolean;
  loadingExecutions: boolean;
  logs: SchedulerExecutionLogResponse[];
  nodes: SchedulerNodeExecutionResponse[];
  onClose: () => void;
  onRefresh: () => void;
  onSelectExecution: (executionId: number) => void;
  open: boolean;
  selectedExecutionId: number | null;
  workflow: Workflow | null;
}) {
  const selectedExecution = executions.find((execution) => execution.id === selectedExecutionId);

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={workflow ? `运行日志 - ${workflow.name}` : '运行日志'}
      showSubmit={false}
      cancelLabel="关闭"
      className="h-[82vh] max-w-6xl"
      bodyClassName="overflow-hidden p-0"
    >
      <div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-slate-50/80">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle px-4">
            <div className="text-sm font-bold text-slate-900">执行记录</div>
            <Button onClick={onRefresh} variant="ghost" className="h-8 px-2" disabled={loadingExecutions || !workflow}>
              <RefreshCw className={`h-3.5 w-3.5 ${loadingExecutions ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {executions.length ? (
              <div className="space-y-2">
                {executions.map((execution) => (
                  <button
                    key={execution.id}
                    type="button"
                    onClick={() => execution.id && onSelectExecution(execution.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${execution.id === selectedExecutionId ? 'border-primary bg-white shadow-sm' : 'border-border bg-white/70 hover:bg-white'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">#{execution.id ?? '-'}</span>
                      <Badge tone={executionStatusTone(execution.status)} className="font-semibold">
                        {statusLabel(execution.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs font-medium text-slate-500">
                      <span>触发：{execution.triggerType ?? '-'}</span>
                      <span className="text-right">耗时：{formatBackendUtcDuration(execution.startedAt, execution.finishedAt)}</span>
                      <span className="col-span-2 truncate">开始：{formatBackendUtcDateTime(execution.startedAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-white p-4 text-sm font-medium text-muted-foreground">
                {loadingExecutions ? '正在加载执行记录...' : '暂无执行记录，运行一次工作流后会出现在这里。'}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-white">
          <div className="shrink-0 border-b border-border-subtle px-5 py-4">
            {selectedExecution ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-bold text-slate-900">执行实例 #{selectedExecution.id}</span>
                <Badge tone={executionStatusTone(selectedExecution.status)} className="font-semibold">
                  {statusLabel(selectedExecution.status)}
                </Badge>
                <span className="font-medium text-slate-500">开始：{formatBackendUtcDateTime(selectedExecution.startedAt)}</span>
                <span className="font-medium text-slate-500">结束：{formatBackendUtcDateTime(selectedExecution.finishedAt)}</span>
                <span className="font-medium text-slate-500">耗时：{formatBackendUtcDuration(selectedExecution.startedAt, selectedExecution.finishedAt)}</span>
              </div>
            ) : (
              <div className="text-sm font-medium text-muted-foreground">请选择左侧执行记录查看日志。</div>
            )}
            {selectedExecution?.message ? (
              <div className="mt-2 text-sm font-medium text-slate-500">{selectedExecution.message}</div>
            ) : null}
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
            <div className="border-b border-border-subtle px-5 py-4">
              <div className="mb-3 text-sm font-bold text-slate-900">节点明细</div>
              {nodes.length ? (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {nodes.map((node) => (
                    <div key={node.id ?? node.nodeKey} className="rounded-lg border border-border bg-slate-50/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-slate-900" title={node.nodeKey}>{node.nodeKey ?? '-'}</span>
                        <Badge tone={executionStatusTone(node.status)} className="font-semibold">
                          {statusLabel(node.status)}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs font-medium text-slate-500">
                        重试：{node.retryIndex ?? 0} | 耗时：{formatBackendUtcDuration(node.startedAt, node.finishedAt)}
                      </div>
                      {node.message ? <div className="mt-1 truncate text-xs text-slate-400" title={node.message}>{node.message}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-slate-50 p-4 text-sm font-medium text-muted-foreground">
                  {loadingDetails ? '正在加载节点明细...' : '当前执行暂无节点明细。'}
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-col bg-slate-950">
              <div className="flex h-10 shrink-0 items-center gap-2 border-b border-slate-800 px-4 text-xs font-bold text-zinc-400">
                <Terminal className="h-3.5 w-3.5 text-amber-500" />
                执行日志
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
                {detailsError ? <div className="text-rose-400">{detailsError}</div> : null}
                {!detailsError && loadingDetails ? <div className="text-zinc-500">正在加载日志...</div> : null}
                {!detailsError && !loadingDetails && logs.length === 0 ? <div className="text-zinc-500">当前执行暂无日志。</div> : null}
                {!detailsError && logs.map((log) => {
                  const node = log.nodeKey ? ` [${log.nodeKey}]` : '';
                  const event = log.eventType ? ` ${log.eventType}` : '';
                  return (
                    <div key={log.id ?? `${log.createdAt}-${log.eventType}-${log.message}`} className={logColorClass(log)}>
                      [{formatBackendUtcDateTime(log.createdAt)}] [{log.level ?? 'INFO'}]{node}{event} | {log.message ?? '-'}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
